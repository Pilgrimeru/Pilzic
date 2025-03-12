# Pilzic 🎵 – Just Music!

![banner](https://i.imgur.com/y73VY4q.jpg)

**Pilzic** is the **no-BS Discord music bot** you actually need! 🎶 No endless setup, no extra API keys – just **drop in your Discord token and go!**

⚡ **Blazing fast** & smooth as butter  
🎧 **YouTube Friendly™** (Yes, it works with YouTube!)  
🦾 **No third-party APIs** – **forget Lavalink** and other headaches  
💾 **Lightweight AF** – uses less than **200MiB of RAM**

## 🎶 Why Pilzic?

- **🎵 Pure music, no distractions.** Everything you need, nothing you don’t.
- **🔄 Simple & efficient.** Slash commands, prefix commands, and interactive buttons.
- **🌍 Multilingual.** English or French? Pilzic speaks both!
- **🗑️ Keeps your chat clean.** Auto-deletes bot messages.
- **🎯 Built for speed & stability.** Starts instantly, never crashes.

## 🛠️ Get Started in 2 Minutes

### Option 1: With Docker 🐳 (Recommended)

#### 🔧 Requirements

- **Docker** (20.10+) – [Download here](https://www.docker.com/get-started)
- **A Discord bot token** – Get one from the [Discord Developer Portal](https://discord.com/developers/applications)

#### 🚀 Setup

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
cp config.env.example config.env
docker build -t pilzic .
docker run -d --name pilzic --restart=always -e TOKEN="your-discord-bot-token" pilzic
```

And **boom**, your bot is ready to roll. 🎉

---

### Option 2: Manual Installation 🛠️

If you prefer doing things the old-school way 👨‍💻

#### 🔧 Requirements

- **Bun** (1.1.31+) – [Download here](https://bun.sh/)
- **A Discord bot token**

#### ⚡ Quick Install

```bash
git clone https://github.com/Pilgrimeru/Pilzic.git
cd Pilzic
bun install
cp config.env.example config.env  # Add your token inside
bun start
```

And just like that, you’re ready to blast some tunes 🎵

---

## 📜 Commands (Only What Matters)

<details>
<summary>📌 Click to expand the list</summary>

🎶 **Playback & Queue Management**

- `/play (p)` - Play music from YouTube, Spotify, etc.
- `/pause` - Pause the current track.
- `/resume (r)` - Resume playback.
- `/skip (s)` - Skip the current track.
- `/stop` - Stop all music.
- `/queue (q)` - Show the queue.
- `/autoplay` - Enable automatic queue filling.
- `/loop (l)` - Loop the current track.
- `/shuffle` - Shuffle the queue.
- `/insert` - Add a track to the start of the queue.
- `/move (m)` - Move a track within the queue.
- `/remove (rm)` - Remove a track from the queue.
- `/previous` - Go back in the queue.
- `/jumpto (jump)` - Jump to a specific track in the queue.

🔧 **Utilities & Information**

- `/ping` - Check bot response time.
- `/lyrics (ly)` - Show lyrics of the current track.
- `/nowplaying (np)` - Show what's currently playing.
- `/volume (v)` - Adjust volume.
- `/search (sh)` - Search and select videos to play.
- `/uptime (up)` - Check how long the bot has been running.
- `/help (h)` - Show all available commands.
- `/invite` - Get the bot’s invite link.
</details>

---

## 📸 Screenshot

![buttons](https://i.imgur.com/B1WKjlO.png)

---

## 📄 License

**MIT License** – Use it, modify it, improve it. Just don’t break it! 😉

Got a question, found a bug, or have a cool idea? Drop by the [issues page](https://github.com/Pilgrimeru/Pilzic/issues).

🔥 **Pilzic – just music, nothing else.** 🔥
