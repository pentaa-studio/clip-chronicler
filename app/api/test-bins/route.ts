import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function GET() {
  try {
    console.log('🔍 Testing binary availability...')
    
    // Test ffmpeg
    const ffmpegResult = await new Promise((resolve) => {
      const process = spawn('ffmpeg', ['-version'], { stdio: 'pipe' })
      let output = ''
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      process.on('close', (code) => {
        resolve({ success: code === 0, output: output.slice(0, 200) })
      })
    })
    
    // Test yt-dlp
    const ytdlpResult = await new Promise((resolve) => {
      const process = spawn('yt-dlp', ['--version'], { stdio: 'pipe' })
      let output = ''
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      process.on('close', (code) => {
        resolve({ success: code === 0, output: output.slice(0, 200) })
      })
    })
    
    return NextResponse.json({
      ffmpeg: ffmpegResult,
      ytdlp: ytdlpResult,
      timestamp: new Date().toISOString()
    })
    
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
