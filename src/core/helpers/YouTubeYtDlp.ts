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

export function getYouTubePlaylistUrl(value: string): string {
  const url = new URL(value);
  const listId = url.searchParams.get("list");
  if (!listId) return value;
  if (listId.startsWith("RD")) {
    // Mixes live on the watch page, not the regular playlist page.
    const videoId =
      url.searchParams.get("v") ??
      (url.hostname === "youtu.be" ? url.pathname.slice(1) : undefined) ??
      (/^RD[\w-]{11}$/.test(listId) ? listId.slice(2) : undefined);
    if (!videoId) return value;
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&list=${encodeURIComponent(listId)}`;
  }
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`;
}

function getYouTubeArgs(): string[] {
  const args = ["--js-runtimes", `bun:${process.execPath}`];
  if (config.YOUTUBE_COOKIES_PATH) {
    if (!existsSync(config.YOUTUBE_COOKIES_PATH))
      throw new Error(`Cookie file not found: ${config.YOUTUBE_COOKIES_PATH}`);
    args.push("--cookies", config.YOUTUBE_COOKIES_PATH);
  }
  return args;
}

export async function getYouTubeVideoInfo(
  url: string,
  signal?: AbortSignal,
): Promise<YouTubePlaylistEntry> {
  return runYtDlpJson<YouTubePlaylistEntry>(
    [
      url,
      "--dump-single-json",
      "--no-playlist",
      "--skip-download",
      "--no-warnings",
      ...getYouTubeArgs(),
    ],
    signal,
  );
}

export async function getYouTubePlaylistInfo(
  url: string,
  signal?: AbortSignal,
): Promise<YouTubePlaylistInfo> {
  const args = [
    getYouTubePlaylistUrl(url),
    "--dump-single-json",
    "--flat-playlist",
    "--yes-playlist",
    "--skip-download",
    "--no-warnings",
    "--playlist-end",
    String(config.MAX_PLAYLIST_SIZE),
    ...getYouTubeArgs(),
  ];
  return runYtDlpJson<YouTubePlaylistInfo>(args, signal);
}
