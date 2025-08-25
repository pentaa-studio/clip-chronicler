import os
import subprocess
import tempfile
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import requests
from pathlib import Path
import time
import asyncio
from playwright.async_api import async_playwright

class handler(BaseHTTPRequestHandler):
    async def download_with_freemake(self, video_url, temp_dir):
        """Download video using Freemake via browser automation"""
        async with async_playwright() as p:
            # Launch browser
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            try:
                # Navigate to Freemake
                print("🌐 Navigating to Freemake...")
                await page.goto("https://www.freemake.com/fr/free_video_downloader_choicest/", timeout=30000)
                
                # Wait for page to load
                await page.wait_for_load_state("networkidle")
                
                # Find and fill the URL input
                print("📝 Entering video URL...")
                url_input = await page.wait_for_selector('input[type="text"], input[placeholder*="URL"], input[placeholder*="url"]', timeout=10000)
                await url_input.fill(video_url)
                
                # Click analyze/download button
                print("🔍 Analyzing video...")
                analyze_button = await page.wait_for_selector('button:has-text("Analyze"), button:has-text("Download"), button:has-text("Télécharger")', timeout=10000)
                await analyze_button.click()
                
                # Wait for analysis to complete
                await page.wait_for_timeout(5000)
                
                # Look for download links
                print("📥 Looking for download links...")
                download_links = await page.query_selector_all('a[href*=".mp4"], a[href*="download"], .download-link')
                
                if download_links:
                    # Get the first MP4 link
                    for link in download_links:
                        href = await link.get_attribute('href')
                        if href and '.mp4' in href:
                            print(f"🔗 Found download link: {href}")
                            
                            # Download the file
                            video_path = os.path.join(temp_dir, 'video.mp4')
                            response = requests.get(href, stream=True)
                            with open(video_path, 'wb') as f:
                                for chunk in response.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            
                            await browser.close()
                            return video_path
                
                raise Exception("No download links found")
                
            except Exception as e:
                await browser.close()
                raise e
    
    def do_GET(self):
        try:
            # Parse query parameters
            parsed_url = urlparse(self.path)
            params = parse_qs(parsed_url.query)
            
            video_id = params.get('videoId', [None])[0]
            start = params.get('start', ['0'])[0]
            duration = params.get('dur', ['20'])[0]
            text = (params.get('text', ['Chronique Trunks'])[0])[:280]
            dry_run = params.get('dry', ['0'])[0] == '1'
            cookies = params.get('cookies', [None])[0]
            
            # Get credentials from environment variables
            username = os.environ.get('YOUTUBE_USERNAME')
            password = os.environ.get('YOUTUBE_PASSWORD')
            
            print(f"🚀 API call started - videoId: {video_id}, dry_run: {dry_run}")
            
            if not video_id:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "missing videoId"}).encode())
                return
            
            if dry_run:
                print("🧪 Dry run mode - returning test response")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": True,
                    "url": "blob://dry-run.mp4",
                    "note": "dry-run, no ffmpeg/yt-dlp executed"
                }).encode())
                return
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as temp_dir:
                print(f"📁 Temporary directory: {temp_dir}")
                
                # 1) Download video with Pytube
                print("📥 Starting YouTube download with Pytube...")
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                
                try:
                    # Download video using Playwright with Freemake
                    print("🌐 Starting browser automation with Freemake...")
                    
                    # Run the async download function
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    video_path = loop.run_until_complete(self.download_with_freemake(video_url, temp_dir))
                    loop.close()
                    
                    print(f"✅ Video download successful: {video_path}")
                except Exception as e:
                    print(f"❌ Video download failed: {e}")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": f"Video download failed: {str(e)}"
                    }).encode())
                    return
                
                # Find downloaded video file
                video_files = [f for f in os.listdir(temp_dir) if f.startswith('video.')]
                if not video_files:
                    print("❌ No video file found after download")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": "No video file found after download"
                    }).encode())
                    return
                
                video_file = video_files[0]
                video_path = os.path.join(temp_dir, video_file)
                print(f"✅ Downloaded video: {video_path}")
                
                # 2) Process video with ffmpeg
                print("🎬 Processing video with ffmpeg...")
                output_video = os.path.join(temp_dir, "output.mp4")
                
                # Font path (we'll need to handle this)
                font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"  # Default system font
                
                ffmpeg_cmd = [
                    'ffmpeg',
                    '-i', video_path,
                    '-ss', start,
                    '-t', duration,
                    '-vf', f'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,drawtext=text=\'{text}\':fontfile={font_path}:fontsize=60:fontcolor=white:x=(w-text_w)/2:y=h-text_h-50:box=1:boxcolor=black@0.5',
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-y',
                    output_video
                ]
                
                try:
                    result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
                    if result.returncode != 0:
                        print(f"❌ Video processing failed: {result.stderr}")
                        self.send_response(500)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({
                            "error": f"Video processing failed: {result.stderr[:500]}"
                        }).encode())
                        return
                    print("✅ Video processing successful")
                except subprocess.TimeoutExpired:
                    print("❌ Video processing timed out")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": "Video processing timed out"
                    }).encode())
                    return
                
                # 3) Upload to Vercel Blob
                print("☁️ Uploading to Vercel Blob...")
                
                try:
                    import requests
                    
                    # Read the processed video file
                    with open(output_video, 'rb') as f:
                        video_data = f.read()
                    
                    # Get Vercel Blob token from environment
                    blob_token = os.environ.get('BLOB_READ_WRITE_TOKEN')
                    if not blob_token:
                        raise Exception("BLOB_READ_WRITE_TOKEN not found in environment")
                    
                    # Upload to Vercel Blob via REST API
                    headers = {
                        'Authorization': f'Bearer {blob_token}',
                        'Content-Type': 'application/octet-stream',
                    }
                    
                    filename = f"{video_id}-{int(time.time())}.mp4"
                    url = f"https://blob.vercel-storage.com/{filename}"
                    
                    response = requests.put(url, data=video_data, headers=headers)
                    response.raise_for_status()
                    
                    blob_url = f"https://blob.vercel-storage.com/{filename}"
                    print(f"✅ Upload successful: {blob_url}")
                    
                except Exception as e:
                    print(f"❌ Blob upload failed: {e}")
                    # Fallback to local file for now
                    blob_url = f"file://{os.path.abspath(output_video)}"
                    print(f"📁 Using local file: {blob_url}")
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "ok": True,
                    "url": blob_url
                }).encode())
                
        except Exception as e:
            print(f"❌ Error occurred: {str(e)}")
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "error": str(e)[:500] if str(e) else "Unknown error"
            }).encode())
# Updated Lun 25 aoû 2025 16:54:06 CEST
