# Pilzic 🎵

![banner](https://i.imgur.com/y73VY4q.jpg)

Say hello to **Pilzic** – the fastest, most reliable music bot for Discord! With instant setup, crash-free performance, and good YouTube compatibility, Pilzic makes music control smooth and easy. Get started with quality playback right away!

## Features 🚀

- ⏯ **Multi-Media Control Buttons:** Easily control your music with interactive buttons.
- 🎶 **Source Variety:** Play music from YouTube, Spotify, SoundCloud, Deezer, and direct links.
- 🔍 **Command Autocompletion:** Features autocompletion on the play and insert commands.
- 📎 **Attachment Playback:** Play audio attachments directly.
- 🗨️ **Slash Commands and Prefix Commands:** Use either slash commands or traditional prefix commands.
- 🌐 **Multi-Language Support:** Supports both English and French.
- 🧹 **Auto Message Cleanup:** Automatically removes bot messages for a cleaner chat.
- ⏱️ **Automatic Disconnect:** Automatically disconnects if left alone in a voice channel.

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

   > **Note:** You can also pass the `TOKEN` or any other directly via Docker run command, which will override the value in `config.env`.

#### Step 3: Build the Docker Image

```bash
docker build -t pilzic .
```

#### Step 4: Run the Docker Container

```bash
docker run -d --name pilzic --restart=always pilzic
```
- **`-e TOKEN="your-discord-bot-token"`**: Passes the Discord token directly.
- **`--restart=always`**: Makes sure the container bounces back on reboot or if it *ever* crashes… but come on, we all know it's built like a tank!

### Option 2: Manual Installation 🛠️

If you prefer not to use Docker, follow these steps:

#### Prerequisites

- **Bun:** Version 1.1.31 or higher. [Install Bun](https://bun.sh/)
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
- `-insert`: Add a track to the beginning of the queue.
- `-invite`: Send the bot's invitation link.
- `-jumpto (jump)`: Jump to the selected position in the queue.
- `-loop (l)`: Loop the currently playing music.
- `-lyrics (ly)`: Get the lyrics of the currently playing track.
- `-move (m)`: Move a track within the queue.
- `-nowplaying (np)`: Display the currently playing track.
- `-pause`: Pause the currently playing music.
- `-ping`: Show the bot's ping.
- `-play (p)`: Listen to music from YouTube and other sources.
- `-previous`: Go back in the playback queue.
- `-queue (q)`: Display the playback queue and the currently playing track.
- `-remove (rm)`: Remove a track from the queue.
- `-resume (r)`: Resume playback of the paused music.
- `-search (sh)`: Search and select videos to listen to.
- `-seek`: Jump to a specific point in the currently playing music.
- `-shuffle`: Shuffle the queue.
- `-skip (s)`: Skip the currently playing track.
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