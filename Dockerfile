### Step 1: Use a lightweight image with Bun ###
FROM oven/bun:alpine AS base

# Install ffmpeg via apk (Alpine package manager)
RUN apk add --no-cache ffmpeg

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies with Bun (production only)
RUN bun install --production

# Copy the rest of the code
COPY . .

# Create a non-root user for security purposes
RUN adduser -D appuser
USER appuser

# Set the environment to production mode
ENV NODE_ENV=production

# Command to start the application with Bun
CMD ["bun", "start"]
