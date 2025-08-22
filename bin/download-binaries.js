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
    
    // Download ffmpeg (static build)
    await downloadFile(
      'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
      `${BIN_DIR}/ffmpeg.tar.xz`
    )
    
    // Extract ffmpeg
    console.log('Extracting ffmpeg...')
    execSync(`cd ${BIN_DIR} && tar -xf ffmpeg.tar.xz --strip-components=1 --wildcards '*/ffmpeg'`)
    execSync(`cd ${BIN_DIR} && rm ffmpeg.tar.xz`)
    console.log('✓ ffmpeg extracted')
    
  } catch (error) {
    console.error('Error downloading binaries:', error)
    process.exit(1)
  }
}

main()
