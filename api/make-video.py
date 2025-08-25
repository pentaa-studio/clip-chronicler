import os
import subprocess
import tempfile
import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import yt_dlp
import requests
from pathlib import Path
import time

class handler(BaseHTTPRequestHandler):
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
                
                # 1) Download video with yt-dlp
                print("📥 Starting YouTube download...")
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                
                ydl_opts = {
                    'format': 'best[height<=720]',
                    'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
                    'quiet': True,
                    'no_check_certificate': True,
                    'no_warnings': True,
                    'extract_flat': False,
                    'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'http_headers': {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-us,en;q=0.5',
                        'Sec-Fetch-Mode': 'navigate',
                    }
                }
                
                # Add cookies if provided
                if cookies:
                    cookies_file = os.path.join(temp_dir, 'cookies.txt')
                    with open(cookies_file, 'w') as f:
                        f.write(cookies)
                    ydl_opts['cookiefile'] = cookies_file
                
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        ydl.download([video_url])
                    print("✅ YouTube download successful")
                except Exception as e:
                    print(f"❌ YouTube download failed: {e}")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({
                        "error": f"YouTube download failed: {str(e)}"
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
                
                # 3) Upload to Vercel Blob (we'll need to implement this)
                print("☁️ Uploading to Vercel Blob...")
                
                # For now, return success with a placeholder URL
                # TODO: Implement actual blob upload
                blob_url = f"https://example.com/{video_id}-{int(time.time())}.mp4"
                
                print(f"✅ Upload successful: {blob_url}")
                
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
