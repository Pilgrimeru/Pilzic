# **Pilzic 🎵 – Just Music!**

![banner](https://i.imgur.com/y73VY4q.jpg)

✔️ **Compatible with YouTube** _(Yes, it works!)_
✔️ **No Lavalink or third-party APIs required**
✔️ **Fast, smooth, and reliable**
✔️ **Lightweight (<200MB RAM)**  
✔️ **Multi-language support** \*(Currently available in **English & French**)

---

# **🎵 Music Sources & Search**

## **🔍 Search Functionality**

At the moment, **searching is only available for YouTube**. You can search for videos and playlists.

For other platforms like Spotify and SoundCloud, you'll need to provide direct links.

## **📺 YouTube Support**

| Feature             |  Supported   |
| ------------------- | :----------: |
| **Videos (Tracks)** |      ✅      |
| **Shorts**          |      ✅      |
| **Playlists**       |      ✅      |
| **Mixes**           | ⚠️ (Limited) |
| **Channels**        |      ❌      |
| **Live Streams**    |      ❌      |

## **🎵 Supported Platforms**

Pilzic supports a variety of music sources. Here's what you can play:

| Platform                             | Tracks | Albums | Playlists | Artists |
| ------------------------------------ | :----: | :----: | :-------: | :-----: |
| **SoundCloud**                       |   ✅   |   ✅   |    ✅     |   ❌    |
| **Uploads / Direct Links**           |   ✅   |   -    |     -     |    -    |
| **Spotify** _(Redirects to YouTube)_ |   ✅   |   ✅   |    ✅     |   ❌    |
| **Deezer** _(Redirects to YouTube)_  |   ✅   |   ✅   |    ✅     |   ❌    |

---

# **🚀 Quick & Easy Setup**

Getting started with Pilzic is super simple! Choose your preferred installation method:

### **🐳 Option 1: Docker (Recommended)**

#### **Requirements**

- [**Docker** (20.10+)](https://www.docker.com/get-started)
- **A Discord bot token** – Get one [here](https://discord.com/developers/applications)

#### **Installation**

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
cp config.env.example config.env
docker build -t pilzic .
docker run -d --name pilzic --restart=always -e TOKEN="your-discord-bot-token" pilzic
```

🎉 **Your bot is now up and running!**

### **🛠️ Option 2: Manual Installation**

#### **Requirements**

- [**Bun** (1.1.31+)](https://bun.sh/)
- **A Discord bot token**

#### **Installation**

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
bun install
cp config.env.example config.env  # Add your token inside
bun start
```

✅ **You're all set! Start playing music.**

---

# **📜 Essential Commands**

<details>
<summary>📌 Click to expand</summary>

### **🎶 Playback & Queue Management**

- `/play (p)` - Play music from YouTube, Spotify, etc.
- `/pause` - Pause the current track.
- `/resume (r)` - Resume playback.
- `/skip (s)` - Skip the current track.
- `/seek` - Jump to a specific moment in the current track.
- `/stop` - Stop all music.
- `/queue (q)` - Show the queue.
- `/autoplay` - Enable automatic queue filling.
- `/loop (l)` - Loop the current track.
- `/shuffle` - Shuffle the queue.
- `/insert` - Add a track to the start of the queue.
- `/move (m)` - Move a track within the queue.
- `/remove (rm)` - Remove a track from the queue.
- `/previous` - Go back to the previous track.
- `/jumpto (jump)` - Jump to a specific track.

### **🔧 Utilities & Info**

- `/ping` - Check bot response time.
- `/lyrics (ly)` - Display lyrics for the current track.
- `/nowplaying (np)` - Show what's currently playing.
- `/volume (v)` - Adjust volume.
- `/search (sh)` - Search and play a track or a playlist.
- `/uptime (up)` - Show bot uptime.
- `/help (h)` - List all commands.
- `/invite` - Get the bot’s invite link.
</details>

---

# **📸 User Interface Preview**

![buttons](https://i.imgur.com/B1WKjlO.png)

---

# **📄 License & Contributions**

Pilzic is **open-source** and licensed under the **MIT License**—so feel free to use, modify, and improve it as you like!

💡 **Found a bug, have an idea, or need help?**  
👉 Visit the [**GitHub issues page**](https://github.com/Pilgrimeru/Pilzic/issues) and let us know!
