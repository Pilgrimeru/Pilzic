import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { config } from "config";
import { YouTubeStreamConverter } from "./YouTubeStreamConverter";

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
): Promise<YouTubePlaylistInfo> {
  await YouTubeStreamConverter.ensureYtDlpExists();

  return new Promise((resolve, reject) => {
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
      if (!existsSync(config.YOUTUBE_COOKIES_PATH)) {
        reject(
          new Error(`Cookie file not found: ${config.YOUTUBE_COOKIES_PATH}`),
        );
        return;
      }
      args.push("--cookies", config.YOUTUBE_COOKIES_PATH);
    }

    const child = spawn(YouTubeStreamConverter.getYtDlpPath(), args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > 32 * 1024 * 1024) {
        child.kill("SIGKILL");
        fail(new Error("YouTube playlist metadata response is too large."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-16_384);
    });
    child.once("error", fail);
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        fail(
          new Error(
            `yt-dlp exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
          ),
        );
        return;
      }
      try {
        settled = true;
        resolve(JSON.parse(stdout) as YouTubePlaylistInfo);
      } catch (error) {
        fail(
          new Error("yt-dlp returned invalid YouTube playlist metadata.", {
            cause: error,
          }),
        );
      }
    });
  });
}
