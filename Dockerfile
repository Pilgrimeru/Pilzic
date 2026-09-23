### Step 1: Use a lightweight image with Bun based on Debian ###
FROM oven/bun:1.4.2-slim AS base

# Set the working directory inside the container
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends adduser ffmpeg ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Include the verified yt-dlp release in the image so playback has no download on first use.
ARG TARGETARCH
RUN mkdir -p /app/scripts && \
    arch="${TARGETARCH:-$(dpkg --print-architecture)}" && \
    case "$arch" in \
      amd64) asset=yt-dlp_linux; checksum=58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a ;; \
      arm64) asset=yt-dlp_linux_aarch64; checksum=b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc ;; \
      *) echo "Unsupported architecture: $arch" >&2; exit 1 ;; \
    esac && \
    curl --fail --location --silent --show-error \
      "https://github.com/yt-dlp/yt-dlp/releases/download/2026.08.19/$asset" \
      --output "/app/scripts/$asset" && \
    echo "$checksum  /app/scripts/$asset" | sha256sum -c - && \
    chmod 755 "/app/scripts/$asset"

# Copy dependency files
COPY package.json bun.lockb ./

# Install dependencies with Bun (production only, locked)
RUN bun install --production --frozen-lockfile

# Copy only runtime files. Configuration and secrets are supplied at runtime.
COPY src ./src
COPY tsconfig.json ./

# Create a non-root user for security purposes
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/scripts /app/cache/audio && \
    chown -R appuser:appuser /app/scripts /app/cache

# Create scripts directory with proper permissions for appuser
USER appuser

ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe

# Mount the authenticated cookie file read-only at runtime, for example:
# -v ./secrets/youtube-cookies.txt:/app/secrets/youtube-cookies.txt:ro

# Command to start the application with Bun
CMD ["bun", "start"]
