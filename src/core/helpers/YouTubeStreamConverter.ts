import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { PassThrough, type Readable } from "node:stream";
import { URL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createRequire } from "node:module";
import { config } from "config";
import { audioJobScheduler } from "./AudioJobScheduler";
import { coreMetrics } from "./CoreMetrics";
import { ensureYtDlpExists, getYtDlpPath } from "./YtDlpBinary";

const require = createRequire(import.meta.url);
const ffmpegPath = (() => {
  if (process.env["FFMPEG_PATH"]) return process.env["FFMPEG_PATH"];
  try {
    return require("ffmpeg-static") as string;
  } catch {
    return "ffmpeg";
  }
})();

export interface StreamConverterOptions {
  format?: string;
  quiet?: boolean;
  additionalArgs?: string[];
  seek?: number;
  isLive?: boolean;
  source?: "youtube" | "soundcloud";
  signal?: AbortSignal;
  priority?: number;
}
export type YouTubeErrorCode =
  | "YOUTUBE_AUTH_REQUIRED"
  | "YOUTUBE_AGE_RESTRICTED"
  | "YOUTUBE_UNAVAILABLE"
  | "YOUTUBE_TRANSIENT"
  | "YOUTUBE_EXTRACTION_FAILED";

export class YouTubeStreamError extends Error {
  constructor(
    message: string,
    public readonly code: YouTubeErrorCode = "YOUTUBE_EXTRACTION_FAILED",
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "YouTubeStreamError";
  }
}

const AUTH =
  /sign in to confirm|not a bot|please sign in|login required|http error 429|too many requests/i;
const AGE = /age[- ]restricted|confirm your age|inappropriate for some users/i;
const UNAVAILABLE =
  /video unavailable|private video|deleted video|not available in your country|has been removed/i;
const TRANSIENT =
  /econnreset|socket hang up|connection (?:reset|aborted|timed out)|temporarily unavailable|network is unreachable|unable to download|http error 50[0234]|read timed out|operation timed out|incomplete read|premature eof|broken pipe|remote end closed|transfer closed/i;

function classify(value: string): YouTubeErrorCode {
  if (AUTH.test(value)) return "YOUTUBE_AUTH_REQUIRED";
  if (AGE.test(value)) return "YOUTUBE_AGE_RESTRICTED";
  if (UNAVAILABLE.test(value)) return "YOUTUBE_UNAVAILABLE";
  if (TRANSIENT.test(value)) return "YOUTUBE_TRANSIENT";
  return "YOUTUBE_EXTRACTION_FAILED";
}

export class YouTubeStreamConverter {
  private readonly options: Required<Omit<StreamConverterOptions, "signal">> & {
    signal?: AbortSignal;
  };
  constructor(options: StreamConverterOptions = {}) {
    this.options = {
      format: options.format ?? "bestaudio/best",
      quiet: options.quiet ?? true,
      additionalArgs: options.additionalArgs ?? [],
      seek: options.seek ?? 0,
      isLive: options.isLive ?? false,
      source: options.source ?? "youtube",
      signal: options.signal,
      priority: options.priority ?? 1,
    };
  }

  public async getYouTubeStream(url: string): Promise<Readable> {
    if (!this.isValidUrl(url))
      throw new YouTubeStreamError(`Invalid ${this.label} URL: ${url}`);
    await YouTubeStreamConverter.ensureYtDlpExists();
    let last: YouTubeStreamError | undefined;
    const maxRetries =
      this.options.source === "soundcloud"
        ? config.SOUNDCLOUD_MAX_RETRIES
        : config.YOUTUBE_MAX_RETRIES;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (this.options.signal?.aborted) throw this.options.signal.reason;
      const release = await audioJobScheduler.acquire(
        this.options.priority,
        this.options.signal,
      );
      try {
        const stream = this.transcode(await this.spawnValidated(url), url);
        stream.once("close", release);
        if (stream.destroyed) release();
        return stream;
      } catch (error) {
        release();
        if (this.options.signal?.aborted) throw this.options.signal.reason;
        last =
          error instanceof YouTubeStreamError
            ? error
            : new YouTubeStreamError(String(error));
        if (last.code !== "YOUTUBE_TRANSIENT" || attempt === maxRetries)
          throw last;
        coreMetrics.recordRetry();
        const delay =
          Math.min(1_000 * 2 ** attempt, 10_000) * (0.75 + Math.random() * 0.5);
        console.warn(
          `[${this.label}] transient failure; retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
        );
        await sleep(delay, undefined, { signal: this.options.signal });
      }
    }
    throw last ?? new YouTubeStreamError("YouTube extraction failed.");
  }

  public async transcodeFile(file: string, seek = 0): Promise<Readable> {
    const release = await audioJobScheduler.acquire(
      this.options.priority,
      this.options.signal,
    );
    try {
      const stream = this.transcode(file, file, seek);
      stream.once("close", release);
      if (stream.destroyed) release();
      return stream;
    } catch (error) {
      release();
      throw error;
    }
  }

  public async getDirectOpusStream(
    url: string,
    container: "webm" | "ogg" = "webm",
  ): Promise<Readable> {
    await YouTubeStreamConverter.ensureYtDlpExists();
    const release = await audioJobScheduler.acquire(
      this.options.priority,
      this.options.signal,
    );
    try {
      const direct = new YouTubeStreamConverter({
        ...this.options,
        format: `bestaudio[ext=${container}][acodec=opus]`,
      });
      const stream = await direct.spawnValidated(url);
      stream.once("close", release);
      if (stream.destroyed) release();
      return stream;
    } catch (error) {
      release();
      throw error;
    }
  }

  private spawnValidated(url: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      let stderr = "",
        settled = false;
      const child = spawn(getYtDlpPath(), this.buildArgs(url), {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const abort = () => {
        child.stdout.destroy();
        child.kill("SIGKILL");
        fail("Audio job cancelled");
      };
      this.options.signal?.addEventListener("abort", abort, { once: true });
      child.stdout.once("close", () => {
        if (!child.killed) child.kill("SIGKILL");
      });
      child.once("close", () =>
        this.options.signal?.removeEventListener("abort", abort),
      );
      const timer = setTimeout(
        () => fail("yt-dlp did not produce audio in time"),
        15_000,
      );
      const succeed = () => {
        if (settled) return;
        const firstByte = child.stdout.read(1) as Buffer | null;
        if (!firstByte?.length) return;
        child.stdout.unshift(firstByte);
        settled = true;
        clearTimeout(timer);
        child.stdout.off("readable", succeed);
        this.logLateFailure(child, () => stderr);
        resolve(child.stdout);
      };
      const fail = (message: string, cause?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.stdout.off("readable", succeed);
        child.kill("SIGKILL");
        let code = classify(stderr || message);
        if (
          this.options.source === "soundcloud" &&
          /http error 429|too many requests/i.test(stderr || message)
        )
          code = "YOUTUBE_TRANSIENT";
        if (code === "YOUTUBE_AUTH_REQUIRED")
          console.error(
            `[${this.label}] Authentication rejected${this.options.source === "youtube" ? "; renew the local Netscape cookie file." : "."}`,
          );
        reject(
          new YouTubeStreamError(
            `${message}${stderr ? `: ${stderr.trim()}` : ""}`,
            code,
            cause,
          ),
        );
      };
      if (this.options.signal?.aborted) {
        abort();
        return;
      }
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-4_096);
        if (classify(stderr) !== "YOUTUBE_EXTRACTION_FAILED")
          fail("yt-dlp rejected the source");
      });
      child.stdout.on("readable", succeed);
      child.once("error", (error) => fail("Unable to start yt-dlp", error));
      child.once("close", (code) => {
        if (!settled)
          fail(`yt-dlp exited before producing audio (code ${code})`);
      });
    });
  }

  private logLateFailure(child: ChildProcess, stderr: () => string): void {
    child.once("close", (code) => {
      const details = stderr().trim();
      // Windows may report a deliberately closed stdout pipe as either
      // EPIPE/Errno 32 or EINVAL/Errno 22 depending on timing.
      const consumerClosedPipe =
        /errno (?:22|32)|broken pipe|invalid argument/i.test(details);
      if (code !== 0 && code !== null && !consumerClosedPipe)
        console.error(
          `[${this.label}] yt-dlp failed during playback (code ${code}): ${details.replace(/https?:\/\/\S+/gi, "[url]")}`,
        );
    });
  }

  private transcode(
    source: Readable | string,
    url: string,
    seek = this.options.seek,
  ): Readable {
    if (!ffmpegPath)
      throw new YouTubeStreamError("FFmpeg binary is unavailable.");
    const args = [
      "-loglevel",
      "error",
      "-i",
      typeof source === "string" ? source : "-",
      "-vn",
    ];
    if (seek > 0) args.push("-ss", String(seek));
    args.push(
      "-ar",
      "48000",
      "-ac",
      "2",
      "-acodec",
      "libopus",
      "-b:a",
      `${Math.max(32, Math.min(config.OPUS_BITRATE_KBPS, 192))}k`,
      "-compression_level",
      String(Math.min(config.OPUS_COMPRESSION_LEVEL, 10)),
      "-f",
      "opus",
      "pipe:1",
    );
    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const output = new PassThrough();
    const abort = () => output.destroy(this.options.signal?.reason);
    this.options.signal?.addEventListener("abort", abort, { once: true });
    if (this.options.signal?.aborted) abort();
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-4_096);
    });
    ffmpeg.once("error", (error) => output.destroy(error));
    ffmpeg.stdin.on("error", (error: NodeJS.ErrnoException) => {
      // Expected when a track is skipped: FFmpeg closes stdin while yt-dlp may
      // still have a buffered chunk to write. Without a listener Bun treats
      // this EPIPE as an uncaught exception and terminates the whole bot.
      if (error.code === "EPIPE" || output.destroyed) return;
      output.destroy(error);
    });
    ffmpeg.once("close", (code) => {
      if (code !== 0 && !output.destroyed)
        output.destroy(
          new Error(
            `FFmpeg failed for ${url} (code ${code}): ${stderr.trim()}`,
          ),
        );
    });
    if (typeof source !== "string") {
      source.once("error", (error) => output.destroy(error));
      source.pipe(ffmpeg.stdin);
    } else {
      ffmpeg.stdin.end();
    }
    ffmpeg.stdout.pipe(output);
    output.once("close", () => {
      this.options.signal?.removeEventListener("abort", abort);
      ffmpeg.stdout.unpipe(output);
      if (typeof source !== "string") {
        source.unpipe(ffmpeg.stdin);
        source.destroy();
      }
      ffmpeg.stdin.destroy();
      if (!ffmpeg.killed) ffmpeg.kill("SIGKILL");
    });
    return output;
  }

  private buildArgs(url: string): string[] {
    const format = this.options.isLive
      ? "best[acodec!=none]/bestaudio/best"
      : this.options.format;
    const args = [
      url,
      "--format",
      format,
      "--output",
      "-",
      "--no-playlist",
      "--no-warnings",
    ];
    // JavaScript runtimes are only used by YouTube's extractor. Keeping this
    // option out of SoundCloud calls also preserves compatibility with older
    // bundled yt-dlp binaries that predate --js-runtimes.
    if (this.options.source === "youtube") args.push("--js-runtimes", "node");
    if (this.options.isLive) args.push("--no-live-from-start");
    if (this.options.source === "youtube" && config.YOUTUBE_COOKIES_PATH) {
      if (!existsSync(config.YOUTUBE_COOKIES_PATH))
        throw new YouTubeStreamError(
          `Cookie file not found: ${config.YOUTUBE_COOKIES_PATH}`,
          "YOUTUBE_AUTH_REQUIRED",
        );
      args.push("--cookies", config.YOUTUBE_COOKIES_PATH);
    }
    if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
    if (this.options.quiet) args.push("--quiet");
    return args.concat(this.options.additionalArgs);
  }

  private isValidUrl(value: string): boolean {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return this.options.source === "soundcloud"
        ? /^(?:(?:www|m|on|api)\.)?soundcloud\.com$|^(?:www\.)?snd\.sc$/.test(
            hostname,
          )
        : /^(?:www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(hostname);
    } catch {
      return false;
    }
  }
  private get label(): string {
    return this.options.source === "soundcloud" ? "SoundCloud" : "YouTube";
  }

  public static getYtDlpPath(): string {
    return getYtDlpPath();
  }
  public static async ensureYtDlpExists(): Promise<void> {
    return ensureYtDlpExists();
  }
}

export async function getYouTubeStream(
  url: string,
  options?: StreamConverterOptions,
): Promise<Readable> {
  return new YouTubeStreamConverter(options).getYouTubeStream(url);
}
export async function getSoundCloudStream(
  url: string,
  options: StreamConverterOptions = {},
): Promise<Readable> {
  return new YouTubeStreamConverter({
    ...options,
    source: "soundcloud",
  }).getYouTubeStream(url);
}
export default YouTubeStreamConverter;
