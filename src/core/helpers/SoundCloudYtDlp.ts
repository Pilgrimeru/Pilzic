import { config } from "config";
import { setTimeout as sleep } from "node:timers/promises";
import { runYtDlpJson } from "./YtDlpJson";
import { coreMetrics } from "./CoreMetrics";

export interface SoundCloudInfo {
  title?: string;
  webpage_url?: string;
  original_url?: string;
  duration?: number;
  thumbnail?: string;
  entries?: SoundCloudInfo[];
  formats?: Array<{ ext?: string; acodec?: string }>;
}

const RETRYABLE =
  /http error 429|too many requests|econnreset|socket hang up|timed? out|temporarily unavailable|http error 50[0234]|premature eof|broken pipe/i;

export async function getSoundCloudInfo(
  url: string,
  playlistEnd = config.MAX_PLAYLIST_SIZE,
  signal?: AbortSignal,
): Promise<SoundCloudInfo> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= config.SOUNDCLOUD_MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw signal.reason;
    try {
      return await runYtDlpJson<SoundCloudInfo>(
        [
          url,
          "--dump-single-json",
          "--skip-download",
          "--no-warnings",
          "--playlist-end",
          String(playlistEnd),
        ],
        signal,
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (
        !RETRYABLE.test(lastError.message) ||
        attempt === config.SOUNDCLOUD_MAX_RETRIES
      )
        throw lastError;
      coreMetrics.recordRetry();
      const delay =
        Math.min(1_000 * 2 ** attempt, 10_000) * (0.75 + Math.random() * 0.5);
      await sleep(delay, undefined, { signal });
    }
  }
  throw lastError ?? new Error("Unable to retrieve SoundCloud metadata");
}
