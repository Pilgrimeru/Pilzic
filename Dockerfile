### Step 1: Use a lightweight image with Bun based on Debian ###
FROM oven/bun:slim AS base

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies with Bun (production only)
RUN bun install --production

# Copy the rest of the code
COPY . .

# Create a non-root user for security purposes
RUN adduser --disabled-password --gecos "" appuser && \
    mkdir -p /app/scripts && chown -R appuser:appuser /app/scripts

# Create scripts directory with proper permissions for appuser
USER appuser

# Command to start the application with Bun
CMD ["bun", "start"]
