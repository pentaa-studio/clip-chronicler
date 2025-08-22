import { NextResponse } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import path from 'path'
import fs from 'fs'

// Force Node.js runtime, disable caching, allow 60s execution
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Binary paths - use system binaries on Vercel, local binaries on development
const BIN = {
  ffmpeg: process.env.VERCEL ? 'ffmpeg' : 
          (fs.existsSync(path.join(process.cwd(), 'bin', 'ffmpeg')) ? 
           path.join(process.cwd(), 'bin', 'ffmpeg') : 'ffmpeg'),
  ytdlp:  process.env.VERCEL ? 'yt-dlp' : 
          (fs.existsSync(path.join(process.cwd(), 'bin', 'yt-dlp')) ? 
           path.join(process.cwd(), 'bin', 'yt-dlp') : 'yt-dlp'),
}
const FONT = path.join(process.cwd(), 'assets', 'font.ttf')

// Download binary if not exists (for Vercel deployment)
async function ensureBinary(name: string, url: string, binPath: string) {
  if (!fs.existsSync(binPath)) {
    console.log(`Downloading ${name} from ${url}...`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to download ${name}`)
    
    const buffer = await response.arrayBuffer()
    fs.writeFileSync(binPath, Buffer.from(buffer))
    fs.chmodSync(binPath, 0o755)
    console.log(`${name} downloaded successfully`)
  }
}

// Initialize binaries on Vercel
async function initBinaries() {
  if (process.env.VERCEL) {
    await ensureBinary('ffmpeg', 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz', BIN.ffmpeg)
    await ensureBinary('yt-dlp', 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', BIN.ytdlp)
  }
}

function exec(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore','pipe','pipe'] })
    let stdout = ''
    let stderr = ''
    p.stdout.on('data', d => stdout += d.toString())
    p.stderr.on('data', d => stderr += d.toString())
    p.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}. stderr: ${stderr}`))
      }
    })
  })
}

export async function GET(req: Request) {
  try {
    // Initialize binaries only in development
    if (!process.env.VERCEL) {
      await initBinaries()
    }
    
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('videoId')!
    const start    = searchParams.get('start') || '0'        // seconds (ex 30)
    const dur      = searchParams.get('dur')   || '20'       // 20s default
    const text     = (searchParams.get('text') || 'Chronique Trunks').slice(0,280)
    const voiceUrl = searchParams.get('voice') || ''         // URL mp3/wav (optional)
    const dry      = searchParams.get('dry') === '1'         // dry-run mode

    if (!videoId) return NextResponse.json({ error: 'missing videoId' }, { status: 400 })

    // Dry-run mode: skip ffmpeg/yt-dlp execution and return test response
    if (dry) {
      return NextResponse.json({
        ok: true,
        url: "blob://dry-run.mp4",
        note: "dry-run, no ffmpeg/yt-dlp executed"
      })
    }

    // work paths
    const inFile   = '/tmp/in.mp4'
    const vFile    = '/tmp/voice.mp3'
    const mixed    = '/tmp/mixed.mp4'
    const outFile  = '/tmp/out.mp4'
    const ytUrl    = `https://www.youtube.com/watch?v=${videoId}`

    // 1) Download clip (start/dur) in MP4
    //   - sections: "*START-END" (format HH:MM:SS)
    const startH = new Date(+start * 1000).toISOString().substr(11, 8)
    const endH   = new Date((+start + +dur) * 1000).toISOString().substr(11, 8)
    console.log(`Downloading ${ytUrl} from ${startH} to ${endH} to ${inFile}`)
    await exec(BIN.ytdlp, [
      '-f','bv*+ba/b','--merge-output-format','mp4',
      '--download-sections', `*${startH}-${endH}`,
      '-o', inFile, ytUrl
    ])
    console.log(`Download completed, file size: ${fs.existsSync(inFile) ? fs.statSync(inFile).size : 'NOT FOUND'}`)

    // 2) Lower clip volume (if audio exists)
    const clipLow = '/tmp/clip_low.mp4'
    try {
      await exec(BIN.ffmpeg, [
        '-i', inFile, '-filter:a','volume=0.08', // ~ -22 dB
        '-c:v','copy','-c:a','aac','-y', clipLow
      ])
    } catch (e) {
      // If no audio, just copy the video
      await exec(BIN.ffmpeg, [
        '-i', inFile, '-c:v','copy','-y', clipLow
      ])
    }

    // 3) Get voice (optional)
    let audioInputs = ['-i', clipLow]
    let amixFilter = '[0:a]anull[a0]'
    if (voiceUrl) {
      const res = await fetch(voiceUrl)
      if (!res.ok) throw new Error('voice download fail')
      await pipeline(res.body as any, createWriteStream(vFile))
      audioInputs = ['-i', clipLow, '-i', vFile]
      amixFilter = '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[a0]'
    }

    // 4) Mix audio (low clip + voice) and output in 9:16 with drawtext
    //    - scaling + crop 1080x1920
    //    - text overlay at bottom (semi-transparent box)
    await exec(BIN.ffmpeg, [
      ...audioInputs,
      '-filter_complex',
      [
        amixFilter,
        ';',
        // video → 9:16
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v0];',
        // text overlay
        `[v0]drawtext=fontfile=${FONT}:text='${text.replace(/[:']/g, m => m===':'?'\\:':'\\\'')}':fontcolor=white:fontsize=54:box=1:boxcolor=0x00000088:boxborderw=10:x=(w-text_w)/2:y=h-220[v1]`
      ].join(''),
      '-map','[v1]','-map','[a0]',
      '-r','30','-c:v','libx264','-preset','veryfast','-crf','20',
      '-c:a','aac','-b:a','128k','-shortest','-y', mixed
    ])

    // 5) (Optional) clean re-mux if needed
    await exec(BIN.ffmpeg, ['-i', mixed, '-c','copy','-y', outFile])

    // 6) Upload to Google Cloud Storage
    const storage = new Storage()
    const bucketName = 'clip-chronicler-videos'
    const fileName = `trunks/${videoId}-${Date.now()}.mp4`
    
    await storage.bucket(bucketName).upload(outFile, {
      destination: fileName,
      metadata: {
        contentType: 'video/mp4',
      },
    })

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`
    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message?.slice(0,500) }, { status: 500 })
  }
}
