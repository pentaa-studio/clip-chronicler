#!/usr/bin/env node

import { execSync } from 'child_process'
import { writeFileSync, chmodSync } from 'fs'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

const BIN_DIR = './bin'

async function downloadFile(url, outputPath) {
  console.log(`Downloading ${url} to ${outputPath}...`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: ${response.statusText}`)
  
  const buffer = await response.arrayBuffer()
  writeFileSync(outputPath, Buffer.from(buffer))
  chmodSync(outputPath, 0o755)
  console.log(`✓ Downloaded ${outputPath}`)
}

async function main() {
  try {
    // Create bin directory if it doesn't exist
    execSync('mkdir -p bin')
    
    // Download yt-dlp
    await downloadFile(
      'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
      `${BIN_DIR}/yt-dlp`
    )
    
    // Download ffmpeg (static build) - detect platform
    const platform = process.platform
    const arch = process.arch
    
    let ffmpegUrl, ffmpegFile
    if (platform === 'darwin') {
      ffmpegUrl = 'https://evermeet.cx/ffmpeg/getrelease/zip'
      ffmpegFile = 'ffmpeg.zip'
    } else {
      // Linux (Vercel) - use static build
      ffmpegUrl = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz'
      ffmpegFile = 'ffmpeg.tar.xz'
    }
    
    await downloadFile(ffmpegUrl, `${BIN_DIR}/${ffmpegFile}`)
    
    // Extract ffmpeg
    console.log('Extracting ffmpeg...')
    if (platform === 'darwin') {
      execSync(`cd ${BIN_DIR} && unzip -o ffmpeg.zip`)
      execSync(`cd ${BIN_DIR} && rm ffmpeg.zip`)
    } else {
      // Linux (Vercel)
      execSync(`cd ${BIN_DIR} && tar -xf ${ffmpegFile}`)
      // Find and move ffmpeg binary
      execSync(`cd ${BIN_DIR} && find . -name "ffmpeg" -type f -exec mv {} . \\;`)
      // Remove extracted directory
      execSync(`cd ${BIN_DIR} && rm -rf ffmpeg-*`)
      execSync(`cd ${BIN_DIR} && rm ${ffmpegFile}`)
    }
    console.log('✓ ffmpeg extracted')
    
  } catch (error) {
    console.error('Error downloading binaries:', error)
    process.exit(1)
  }
}

main()
