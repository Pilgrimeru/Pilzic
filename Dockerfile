### Step 1: Use a lightweight image with Bun based on Debian ###
FROM oven/bun:1.4.2-slim AS base

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files
COPY package.json bun.lockb ./

# Install dependencies with Bun (production only, locked)
RUN bun install --production --frozen-lockfile

# Copy the rest of the code
COPY . .

# Create a non-root user for security purposes
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/scripts /app/cache/audio && \
    chown -R appuser:appuser /app/scripts /app/cache

# Create scripts directory with proper permissions for appuser
USER appuser

# Mount the authenticated cookie file read-only at runtime, for example:
# -v ./secrets/youtube-cookies.txt:/app/secrets/youtube-cookies.txt:ro

# Command to start the application with Bun
CMD ["bun", "start"]
