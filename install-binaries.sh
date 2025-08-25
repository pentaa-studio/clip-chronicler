#!/bin/bash

# Install yt-dlp
echo "Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /tmp/yt-dlp
chmod +x /tmp/yt-dlp
mv /tmp/yt-dlp /usr/local/bin/yt-dlp

# Verify installation
echo "Verifying yt-dlp installation..."
yt-dlp --version

echo "Installation complete!"
