import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { chmod } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PassThrough, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { URL } from "node:url";
import { config } from "config";
import ffmpegPath from "ffmpeg-static";
import got from "got";

export interface StreamConverterOptions {
  format?: string;
  quiet?: boolean;
  additionalArgs?: string[];
  seek?: number;
  isLive?: boolean;
  source?: "youtube" | "soundcloud";
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
  private static readonly YTDLP_PATH = this.getYtDlpPath();
  private readonly options: Required<StreamConverterOptions>;
  constructor(options: StreamConverterOptions = {}) {
    this.options = {
      format: options.format ?? "bestaudio/best",
      quiet: options.quiet ?? true,
      additionalArgs: options.additionalArgs ?? [],
      seek: options.seek ?? 0,
      isLive: options.isLive ?? false,
      source: options.source ?? "youtube",
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
      try {
        return this.transcode(await this.spawnValidated(url), url);
      } catch (error) {
        last =
          error instanceof YouTubeStreamError
            ? error
            : new YouTubeStreamError(String(error));
        if (last.code !== "YOUTUBE_TRANSIENT" || attempt === maxRetries)
          throw last;
        const delay = Math.min(1_000 * 2 ** attempt, 10_000);
        console.warn(
          `[${this.label}] transient failure; retry ${attempt + 1}/${maxRetries} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw last ?? new YouTubeStreamError("YouTube extraction failed.");
  }

  public transcodeFile(file: string, seek = 0): Readable {
    return this.transcode(file, file, seek);
  }

  private spawnValidated(url: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      let stderr = "",
        settled = false;
      const child = spawn(
        YouTubeStreamConverter.YTDLP_PATH,
        this.buildArgs(url),
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
      );
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.logLateFailure(child, url, () => stderr);
        resolve(child.stdout);
      }, 500);
      const fail = (message: string, cause?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
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
      child.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-16_384);
        if (classify(stderr) !== "YOUTUBE_EXTRACTION_FAILED")
          fail("yt-dlp rejected the source");
      });
      child.once("error", (error) => fail("Unable to start yt-dlp", error));
      child.once("close", (code) => {
        if (!settled && code !== 0) fail(`yt-dlp exited with code ${code}`);
      });
    });
  }

  private logLateFailure(
    child: ChildProcess,
    url: string,
    stderr: () => string,
  ): void {
    child.once("close", (code) => {
      const details = stderr().trim();
      // Windows may report a deliberately closed stdout pipe as either
      // EPIPE/Errno 32 or EINVAL/Errno 22 depending on timing.
      const consumerClosedPipe =
        /errno (?:22|32)|broken pipe|invalid argument/i.test(details);
      if (code !== 0 && code !== null && !consumerClosedPipe)
        console.error(
          `[${this.label}] yt-dlp failed during playback (${url}, code ${code}): ${details}`,
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
      "-f",
      "opus",
      "pipe:1",
    );
    const ffmpeg = spawn(ffmpegPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const output = new PassThrough();
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-16_384);
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
      "--js-runtimes",
      "node",
      "--format",
      format,
      "--output",
      "-",
      "--no-playlist",
      "--no-warnings",
    ];
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
    const suffix =
      process.platform === "win32"
        ? ".exe"
        : process.platform === "darwin"
          ? "_macos"
          : process.arch === "arm64"
            ? "_linux_aarch64"
            : process.arch === "arm"
              ? "_linux_armv7l"
              : "_linux";
    return path.resolve(process.cwd(), "scripts", `yt-dlp${suffix}`);
  }
  public static async ensureYtDlpExists(): Promise<void> {
    if (existsSync(this.YTDLP_PATH)) return;
    mkdirSync(path.dirname(this.YTDLP_PATH), { recursive: true });
    const release = await got(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest",
    ).json<{ assets: Array<{ name: string; browser_download_url: string }> }>();
    const asset = release.assets.find(
      ({ name }) => name === path.basename(this.YTDLP_PATH),
    );
    if (!asset)
      throw new YouTubeStreamError(
        `No yt-dlp binary for ${process.platform}/${process.arch}.`,
      );
    await pipeline(
      got.stream(asset.browser_download_url, {
        timeout: { request: 30_000 },
        retry: { limit: 2 },
      }),
      createWriteStream(this.YTDLP_PATH),
    );
    if (process.platform !== "win32") await chmod(this.YTDLP_PATH, 0o755);
  }
}

export async function getYouTubeStream(
  url: string,
  options?: StreamConverterOptions,
): Promise<Readable> {
  return new YouTubeStreamConverter(options).getYouTubeStream(url);
}
export async function getSoundCloudStream(url: string): Promise<Readable> {
  return new YouTubeStreamConverter({ source: "soundcloud" }).getYouTubeStream(
    url,
  );
}
export default YouTubeStreamConverter;
