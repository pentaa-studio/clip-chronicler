import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import fs from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 secondes pour le plan gratuit

        // Binary paths - use system binaries on Vercel, local binaries in dev
        const BIN = {
          ffmpeg: 'ffmpeg',
          ytdlp: 'yt-dlp'
        }
const FONT = path.join(process.cwd(), 'assets', 'font.ttf')

function exec(cmd: string, args: string[]): Promise<{ success: boolean, output: string }> {
  return new Promise((resolve) => {
    const process = spawn(cmd, args, { stdio: 'pipe' })
    let stdout = ''
    let stderr = ''

    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout })
      } else {
        resolve({ success: false, output: stderr })
      }
    })
  })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('videoId')
    const start = searchParams.get('start') || '0'
    const duration = searchParams.get('dur') || '20'
    const text = (searchParams.get('text') || 'Chronique Trunks').slice(0, 280)
    const voiceUrl = searchParams.get('voice') || ''
    const dryRun = searchParams.get('dry') === '1'
    const cookies = searchParams.get('cookies')

    if (!videoId) {
      return NextResponse.json({ error: 'missing videoId' }, { status: 400 })
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        url: 'blob://dry-run.mp4',
        note: 'dry-run, no ffmpeg/yt-dlp executed'
      })
    }

                // Create temporary directory
            const tempDir = path.join('/tmp', Date.now().toString())
            fs.mkdirSync(tempDir, { recursive: true })

    try {
      console.log(`Working in temporary directory: ${tempDir}`)

      // 1) Download video with yt-dlp
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
      const ydlArgs = [
        '--format', 'best[height<=720]',
        '--output', path.join(tempDir, 'video.%(ext)s'),
        '--quiet',
        '--no-check-certificate'
      ]

      // Add cookies if provided (optional)
      if (cookies) {
        const cookiesFile = path.join(tempDir, 'cookies.txt')
        fs.writeFileSync(cookiesFile, cookies)
        ydlArgs.push('--cookies', cookiesFile)
      }

      // Add user agent and headers
      ydlArgs.push(
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-us,en;q=0.5',
        '--add-header', 'Sec-Fetch-Mode:navigate'
      )

      ydlArgs.push(videoUrl)

      const { success: ydlSuccess, output: ydlOutput } = await exec(BIN.ytdlp, ydlArgs)
      
      if (!ydlSuccess) {
        return NextResponse.json({ 
          error: `YouTube download failed: ${ydlOutput.slice(0, 500)}` 
        }, { status: 500 })
      }

      // Find downloaded video file
      const files = fs.readdirSync(tempDir)
      const videoFile = files.find(f => f.startsWith('video.'))
      if (!videoFile) {
        return NextResponse.json({ error: 'No video file found after download' }, { status: 500 })
      }

      const videoPath = path.join(tempDir, videoFile)
      console.log(`Downloaded video: ${videoPath}`)

      // 2) Extract audio if exists
      const audioFile = path.join(tempDir, 'audio.mp3')
      const { success: audioSuccess } = await exec(BIN.ffmpeg, [
        '-i', videoPath,
        '-ss', start,
        '-t', duration,
        '-vn', '-acodec', 'mp3',
        '-y', audioFile
      ])

      if (!audioSuccess) {
        console.log('Warning: Could not extract audio')
      }

      // 3) Process video with ffmpeg
      const outputVideo = path.join(tempDir, 'output.mp4')
      const { success: ffmpegSuccess, output: ffmpegOutput } = await exec(BIN.ffmpeg, [
        '-i', videoPath,
        '-ss', start,
        '-t', duration,
        '-vf', `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,drawtext=text='${text}':fontfile=${FONT}:fontsize=60:fontcolor=white:x=(w-text_w)/2:y=h-text_h-50:box=1:boxcolor=black@0.5`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-y', outputVideo
      ])

      if (!ffmpegSuccess) {
        return NextResponse.json({ 
          error: `Video processing failed: ${ffmpegOutput.slice(0, 500)}` 
        }, { status: 500 })
      }

      // 4) Mix audio if available
      let finalFile = outputVideo
      if (audioSuccess && fs.existsSync(audioFile)) {
        const mixedFile = path.join(tempDir, 'mixed.mp4')
        const { success: mixSuccess } = await exec(BIN.ffmpeg, [
          '-i', outputVideo,
          '-i', audioFile,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          '-y', mixedFile
        ])

        if (mixSuccess) {
          finalFile = mixedFile
        } else {
          console.log('Warning: Audio mixing failed')
        }
      }

      // 5) Upload to Vercel Blob
      const fileBuffer = fs.readFileSync(finalFile)
      const blob = await put(`${videoId}-${Date.now()}.mp4`, fileBuffer, {
        access: 'public',
      })

      return NextResponse.json({ ok: true, url: blob.url })

    } finally {
      // Cleanup temporary files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        console.log('Warning: Could not cleanup temp directory')
      }
    }

  } catch (e: any) {
    return NextResponse.json({ 
      error: e.message?.slice(0, 500) || 'Unknown error' 
    }, { status: 500 })
  }
}
