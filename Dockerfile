### Step 1: Use a lightweight image with Bun based on Debian ###
FROM oven/bun:debian AS base

# Install ffmpeg via apt (Debian package manager)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies with Bun (production only)
RUN bun install --production

# Copy the rest of the code
COPY . .

# Create a non-root user for security purposes
RUN adduser --disabled-password --gecos "" appuser
USER appuser

# Set the environment to production mode
ENV NODE_ENV=production

# Command to start the application with Bun
CMD ["bun", "start"]
