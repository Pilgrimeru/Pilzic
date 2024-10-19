# Pilzic 🎵

![banner](https://i.imgur.com/y73VY4q.jpg)

**Pilzic** is a feature-rich Discord bot designed to provide a seamless music experience in your Discord server. Play tracks from various sources like YouTube, Spotify, SoundCloud, Deezer, and direct links. Manage your music queue effortlessly and enjoy interactive controls with ease.

## Features 🚀

- 🎵 **Multi-Media Control Buttons:** Easily control your music with interactive buttons.
- 🌐 **Multi-Language Support:** Supports both English and French.
- 🎶 **Source Variety:** Play music from YouTube, Spotify, SoundCloud, Deezer, and direct links.
- 📎 **Attachment Playback:** Play audio attachments directly.
- ⏱️ **Automatic Disconnect:** Automatically disconnects if left alone in a voice channel.
- 🗨️ **Slash Commands and Prefix Commands:** Use either slash commands or traditional prefix commands.
- 🧹 **Auto Message Cleanup:** Automatically removes bot messages for a cleaner chat.
- 💪 **Strongly Typed Code:** Coded in TypeScript for robust and error-free operation.
- ⚡ **Asynchronous Operations:** Ensures accelerated bot responsiveness.
- 🤖 **Powered by discord.js and play-dl:** Utilizes reliable modules for consistent functionality.

## Getting Started 📋

Follow the steps below to set up and run Pilzic. Docker installation is recommended for beginners due to its simplicity and ease of use.

### Option 1: Using Docker 🐋 (Recommended)

#### Prerequisites

Before you begin, ensure you have the following installed:

- **Docker:** Version 20.10 or higher. [Download Docker](https://www.docker.com/get-started)
- **Discord API Token:** Obtain from the [Discord Developer Portal](https://discord.com/developers/applications).

#### Step 1: Clone the Repository

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
```

#### Step 2: Configure Environment Variables

1. Rename the example configuration file:

   ```bash
   cp config.env.example config.env
   ```

2. Open `config.env` in a text editor and fill in the necessary values:

   ```env
   TOKEN="your-discord-bot-token" # Your Discord bot token
   MAX_PLAYLIST_SIZE=500
   PREFIX="!"
   AUTO_DELETE=true
   LOCALE="en"
   STAY_TIME=30
   AUDIO_QUALITY=0
   DEFAULT_VOLUME=100
   MAIN_COLOR="#69ADC7"
   ```

   > **Note:** You can also pass the `TOKEN` directly via Docker run command, which will override the value in `config.env`.

#### Step 3: Build the Docker Image

```bash
docker build -t pilzic .
```

#### Step 4: Run the Docker Container

```bash
docker run -d --name pilzic \
  --restart=always \
  -e TOKEN="your-discord-bot-token" \
  pilzic
```

- **`-e TOKEN="your-discord-bot-token"`**: Passes the Discord token directly.
- **`--restart=always`**: Ensures the container restarts automatically on system reboot or if it crashes.

#### Step 5: Verify the Bot is Running

Check the logs to ensure the bot started successfully:

```bash
docker logs -f pilzic
```

### Option 2: Manual Installation 🛠️

If you prefer not to use Docker, follow these steps:

#### Prerequisites

- **Bun:** Version 1.1.31 or higher. [Install Bun](https://bun.sh/)
- **FFmpeg:** Required for audio processing. [Download FFmpeg](https://ffmpeg.org/download.html)
- **Discord API Token:** Obtain from the [Discord Developer Portal](https://discord.com/developers/applications).

#### Step 1: Clone the Repository

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
```

#### Step 2: Install Dependencies

```bash
bun install
```

#### Step 3: Configure Environment Variables

1. Rename the example configuration file:

   ```bash
   cp config.env.example config.env
   ```

2. Open `config.env` in a text editor and fill in the necessary values

#### Step 4: Start the Bot

```bash
bun start
```

## Command List 📜

<details>
<summary>Click to expand the command list</summary>

- `-autoplay`: Enable automatic queue filling.
- `-help (h)`: Display all available commands and their descriptions.
- `-insert`: Add a song to the beginning of the queue.
- `-invite`: Send the bot's invitation link.
- `-jumpto (jump)`: Jump to the selected position in the queue.
- `-loop (l)`: Loop the currently playing music.
- `-lyrics (ly)`: Get the lyrics of the currently playing song.
- `-move (m)`: Move a song within the queue.
- `-nowplaying (np)`: Display the currently playing song.
- `-pause`: Pause the currently playing music.
- `-ping`: Show the bot's ping.
- `-play (p)`: Listen to music from YouTube and other sources.
- `-previous`: Go back in the playback queue.
- `-queue (q)`: Display the playback queue and the currently playing song.
- `-remove (rm)`: Remove a song from the queue.
- `-resume (r)`: Resume playback of the paused music.
- `-search (sh)`: Search and select videos to listen to.
- `-seek`: Jump to a specific point in the currently playing music.
- `-shuffle`: Shuffle the queue.
- `-skip (s)`: Skip the currently playing song.
- `-stop`: Stop the music playback.
- `-uptime (up)`: Check the bot's uptime.
- `-volume (v)`: Adjust the volume of the currently playing music.

</details>

## Screenshot 📸

![buttons](https://i.imgur.com/B1WKjlO.png)

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Enjoy your music experience with Pilzic! 🎶**

If you have any questions, issues, or suggestions, please feel free to open an [issue](https://github.com/Pilgrimeru/Pilzic/issues) on this repository.