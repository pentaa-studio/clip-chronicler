from flask import Flask, request, jsonify
from google.cloud import storage
import yt_dlp
import ffmpeg
import os
import tempfile
import subprocess
import shutil

app = Flask(__name__)

# Configuration
BUCKET_NAME = 'clip-chronicler-videos'
FONT_PATH = '/app/assets/font.ttf'  # Will be copied in Docker

def exec_command(cmd, args):
    """Execute a command and return success status"""
    try:
        result = subprocess.run([cmd] + args, capture_output=True, text=True, check=True)
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, f"Command failed: {e.stderr}"

@app.route('/api/make-video')
def make_video():
    try:
        # Get parameters
        video_id = request.args.get('videoId')
        start = request.args.get('start', '0')
        duration = request.args.get('dur', '20')
        text = request.args.get('text', 'Chronique Trunks')[:280]
        voice_url = request.args.get('voice', '')
        dry_run = request.args.get('dry') == '1'

        if not video_id:
            return jsonify({"error": "missing videoId"}), 400

        if dry_run:
            return jsonify({
                "ok": True,
                "url": "blob://dry-run.mp4",
                "note": "dry-run, no ffmpeg/yt-dlp executed"
            })

        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            print(f"Working in temporary directory: {temp_dir}")
            
            # 1) Download video with yt-dlp
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            ydl_opts = {
                'format': 'best[height<=720]',
                'outtmpl': os.path.join(temp_dir, 'video.%(ext)s'),
                'quiet': True,
                'no_check_certificate': True,
                'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'extractor_args': {
                    'youtube': {
                        'skip': ['dash', 'live'],
                    }
                },
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-us,en;q=0.5',
                    'Sec-Fetch-Mode': 'navigate',
                }
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=True)
                video_file = ydl.prepare_filename(info)
            
            print(f"Downloaded video: {video_file}")

            # 2) Extract audio if exists
            audio_file = os.path.join(temp_dir, 'audio.mp3')
            success, output = exec_command('ffmpeg', [
                '-i', video_file,
                '-ss', start,
                '-t', duration,
                '-vn', '-acodec', 'mp3',
                '-y', audio_file
            ])
            
            if not success:
                print(f"Warning: Could not extract audio: {output}")
                audio_file = None

            # 3) Process video with ffmpeg
            output_video = os.path.join(temp_dir, 'output.mp4')
            
            # Build ffmpeg command
            ffmpeg_cmd = [
                'ffmpeg',
                '-i', video_file,
                '-ss', start,
                '-t', duration,
                '-vf', f'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,drawtext=text=\'{text}\':fontfile={FONT_PATH}:fontsize=60:fontcolor=white:x=(w-text_w)/2:y=h-text_h-50:box=1:boxcolor=black@0.5',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                '-y', output_video
            ]
            
            success, output = exec_command('ffmpeg', ffmpeg_cmd[1:])
            if not success:
                return jsonify({"error": f"Video processing failed: {output}"}), 500

            # 4) Mix audio if available
            if audio_file and os.path.exists(audio_file):
                mixed_file = os.path.join(temp_dir, 'mixed.mp4')
                success, output = exec_command('ffmpeg', [
                    '-i', output_video,
                    '-i', audio_file,
                    '-c:v', 'copy',
                    '-c:a', 'aac',
                    '-shortest',
                    '-y', mixed_file
                ])
                
                if success:
                    final_file = mixed_file
                else:
                    print(f"Warning: Audio mixing failed: {output}")
                    final_file = output_video
            else:
                final_file = output_video

            # 5) Upload to Google Cloud Storage
            storage_client = storage.Client()
            bucket = storage_client.bucket(BUCKET_NAME)
            
            blob_name = f"trunks/{video_id}-{int(os.path.getmtime(final_file))}.mp4"
            blob = bucket.blob(blob_name)
            
            blob.upload_from_filename(final_file)
            
            # Make blob public
            blob.make_public()
            
            public_url = f"https://storage.googleapis.com/{BUCKET_NAME}/{blob_name}"
            
            return jsonify({
                "ok": True,
                "url": public_url
            })

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": str(e)[:500]}), 500

@app.route('/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=False)
