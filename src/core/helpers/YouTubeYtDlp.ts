import { existsSync } from "node:fs";
import { config } from "config";
import { runYtDlpJson } from "./YtDlpJson";

export interface YouTubePlaylistEntry {
  id?: string;
  title?: string;
  url?: string;
  webpage_url?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: Array<{ url?: string }>;
  availability?: string;
}

export interface YouTubePlaylistInfo {
  title?: string;
  webpage_url?: string;
  original_url?: string;
  entries?: Array<YouTubePlaylistEntry | null>;
}

export async function getYouTubePlaylistInfo(
  url: string,
  signal?: AbortSignal,
): Promise<YouTubePlaylistInfo> {
  const args = [
    url,
    "--dump-single-json",
    "--flat-playlist",
    "--skip-download",
    "--no-warnings",
    "--playlist-end",
    String(config.MAX_PLAYLIST_SIZE),
    "--js-runtimes",
    "node",
  ];
  if (config.YOUTUBE_COOKIES_PATH) {
    if (!existsSync(config.YOUTUBE_COOKIES_PATH))
      throw new Error(`Cookie file not found: ${config.YOUTUBE_COOKIES_PATH}`);
    args.push("--cookies", config.YOUTUBE_COOKIES_PATH);
  }
  return runYtDlpJson<YouTubePlaylistInfo>(args, signal);
}
