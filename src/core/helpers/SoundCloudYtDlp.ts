import { spawn } from "node:child_process";
import { config } from "config";
import { YouTubeStreamConverter } from "./YouTubeStreamConverter";

export interface SoundCloudInfo {
  title?: string;
  webpage_url?: string;
  original_url?: string;
  duration?: number;
  thumbnail?: string;
  entries?: SoundCloudInfo[];
}

const RETRYABLE =
  /http error 429|too many requests|econnreset|socket hang up|timed? out|temporarily unavailable|http error 50[0234]|premature eof|broken pipe/i;

export async function getSoundCloudInfo(
  url: string,
  playlistEnd = config.MAX_PLAYLIST_SIZE,
): Promise<SoundCloudInfo> {
  await YouTubeStreamConverter.ensureYtDlpExists();
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= config.SOUNDCLOUD_MAX_RETRIES; attempt++) {
    try {
      return await runYtDlp(url, playlistEnd);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (
        !RETRYABLE.test(lastError.message) ||
        attempt === config.SOUNDCLOUD_MAX_RETRIES
      )
        throw lastError;
      const delay = Math.min(1_000 * 2 ** attempt, 10_000);
      console.warn(
        `[SoundCloud] metadata failure; retry ${attempt + 1}/${config.SOUNDCLOUD_MAX_RETRIES} in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError ?? new Error("Unable to retrieve SoundCloud metadata.");
}

function runYtDlp(url: string, playlistEnd: number): Promise<SoundCloudInfo> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      YouTubeStreamConverter.getYtDlpPath(),
      [
        url,
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        "--playlist-end",
        String(playlistEnd),
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 32 * 1024 * 1024) {
        child.kill("SIGKILL");
        fail(new Error("SoundCloud metadata response is too large."));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-16_384);
    });
    child.once("error", (error) => fail(error));
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
        resolve(JSON.parse(stdout) as SoundCloudInfo);
      } catch (error) {
        fail(
          new Error("yt-dlp returned invalid SoundCloud metadata.", {
            cause: error,
          }),
        );
      }
    });
  });
}
