import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { spawn } from "child_process";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import path from "path";
import fs from "fs";
import youtubedl from "youtube-dl-exec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800; // 800 secondes pour Vercel Pro

const BIN = {
  ffmpeg: "ffmpeg",
};
const FONT = path.join(process.cwd(), "assets", "font.ttf");

function exec(
  cmd: string,
  args: string[]
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const process = spawn(cmd, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";

    process.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    process.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    process.on("close", (code) => {
      if (code === 0) {
        resolve({ success: true, output: stdout });
      } else {
        resolve({ success: false, output: stderr });
      }
    });
  });
}

export async function GET(req: Request) {
  try {
    console.log("🚀 API call started");
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get("videoId");
    const start = searchParams.get("start") || "0";
    const duration = searchParams.get("dur") || "20";
    const text = (searchParams.get("text") || "Chronique Trunks").slice(0, 280);
    const voiceUrl = searchParams.get("voice") || "";
    const dryRun = searchParams.get("dry") === "1";
    const cookies = searchParams.get("cookies");

    console.log(
      `📋 Parameters: videoId=${videoId}, start=${start}, duration=${duration}, text=${text}, dryRun=${dryRun}`
    );

    if (!videoId) {
      return NextResponse.json({ error: "missing videoId" }, { status: 400 });
    }

    if (dryRun) {
      console.log("🧪 Dry run mode - returning test response");
      return NextResponse.json({
        ok: true,
        url: "blob://dry-run.mp4",
        note: "dry-run, no ffmpeg/yt-dlp executed",
      });
    }

    // Create temporary directory
    console.log("📁 Creating temporary directory...");
    const tempDir = path.join("/tmp", Date.now().toString());
    fs.mkdirSync(tempDir, { recursive: true });
    console.log(`✅ Temporary directory created: ${tempDir}`);

    try {
      console.log("🔧 Starting video processing...");

      // 1) Download video with youtube-dl-exec
      console.log("📥 Starting YouTube download...");
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`🔗 Video URL: ${videoUrl}`);
      
      try {
        console.log("⚡ Executing youtube-dl-exec...");
        
        const downloadOptions: any = {
          format: "best[height<=720]",
          output: path.join(tempDir, "video.%(ext)s"),
          quiet: true,
          noCheckCertificates: true
        };

        // Add cookies if provided
        if (cookies) {
          const cookiesFile = path.join(tempDir, "cookies.txt");
          fs.writeFileSync(cookiesFile, cookies);
          downloadOptions.cookies = cookiesFile;
        }

        await youtubedl(videoUrl, downloadOptions);
        console.log("✅ YouTube download successful");
      } catch (error) {
        console.log(`❌ YouTube download failed: ${error}`);
        console.log(`❌ Error details:`, error);
        return NextResponse.json(
          {
            error: `YouTube download failed: ${error}`,
            details: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }

      // Find downloaded video file
      console.log("🔍 Looking for downloaded video file...");
      const files = fs.readdirSync(tempDir);
      console.log(`📂 Files in temp dir: ${files.join(", ")}`);
      const videoFile = files.find((f) => f.startsWith("video."));
      if (!videoFile) {
        console.log("❌ No video file found after download");
        return NextResponse.json(
          { error: "No video file found after download" },
          { status: 500 }
        );
      }

      const videoPath = path.join(tempDir, videoFile);
      console.log(`✅ Downloaded video: ${videoPath}`);

      // 2) Extract audio if exists
      console.log("🎵 Extracting audio...");
      const audioFile = path.join(tempDir, "audio.mp3");
      const { success: audioSuccess } = await exec(BIN.ffmpeg, [
        "-i",
        videoPath,
        "-ss",
        start,
        "-t",
        duration,
        "-vn",
        "-acodec",
        "mp3",
        "-y",
        audioFile,
      ]);

      if (!audioSuccess) {
        console.log("⚠️ Warning: Could not extract audio");
      } else {
        console.log("✅ Audio extracted successfully");
      }

      // 3) Process video with ffmpeg
      console.log("🎬 Processing video with ffmpeg...");
      const outputVideo = path.join(tempDir, "output.mp4");
      const { success: ffmpegSuccess, output: ffmpegOutput } = await exec(
        BIN.ffmpeg,
        [
          "-i",
          videoPath,
          "-ss",
          start,
          "-t",
          duration,
          "-vf",
          `scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,drawtext=text='${text}':fontfile=${FONT}:fontsize=60:fontcolor=white:x=(w-text_w)/2:y=h-text_h-50:box=1:boxcolor=black@0.5`,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-y",
          outputVideo,
        ]
      );

      if (!ffmpegSuccess) {
        console.log(`❌ Video processing failed: ${ffmpegOutput}`);
        return NextResponse.json(
          {
            error: `Video processing failed: ${ffmpegOutput.slice(0, 500)}`,
          },
          { status: 500 }
        );
      }
      console.log("✅ Video processing successful");

      // 4) Mix audio if available
      console.log("🔊 Mixing audio if available...");
      let finalFile = outputVideo;
      if (audioSuccess && fs.existsSync(audioFile)) {
        const mixedFile = path.join(tempDir, "mixed.mp4");
        const { success: mixSuccess } = await exec(BIN.ffmpeg, [
          "-i",
          outputVideo,
          "-i",
          audioFile,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-shortest",
          "-y",
          mixedFile,
        ]);

        if (mixSuccess) {
          finalFile = mixedFile;
          console.log("✅ Audio mixing successful");
        } else {
          console.log("⚠️ Warning: Audio mixing failed");
        }
      } else {
        console.log("ℹ️ No audio to mix");
      }

      // 5) Upload to Vercel Blob
      console.log("☁️ Uploading to Vercel Blob...");
      const fileBuffer = fs.readFileSync(finalFile);
      const blob = await put(`${videoId}-${Date.now()}.mp4`, fileBuffer, {
        access: "public",
      });
      console.log(`✅ Upload successful: ${blob.url}`);

      return NextResponse.json({ ok: true, url: blob.url });
    } finally {
      // Cleanup temporary files
      console.log("🧹 Cleaning up temporary files...");
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log("✅ Cleanup successful");
      } catch (e) {
        console.log("⚠️ Warning: Could not cleanup temp directory");
      }
    }
  } catch (e: any) {
    console.log(`❌ Error occurred: ${e.message}`);
    return NextResponse.json(
      {
        error: e.message?.slice(0, 500) || "Unknown error",
      },
      { status: 500 }
    );
  }
}
