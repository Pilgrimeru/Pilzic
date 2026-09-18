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
    };
  }

  public async getYouTubeStream(url: string): Promise<Readable> {
    if (!this.isValidUrl(url))
      throw new YouTubeStreamError(`Invalid YouTube URL: ${url}`);
    await YouTubeStreamConverter.ensureYtDlpExists();
    let last: YouTubeStreamError | undefined;
    for (let attempt = 0; attempt <= config.YOUTUBE_MAX_RETRIES; attempt++) {
      try {
        return this.transcode(await this.spawnValidated(url), url);
      } catch (error) {
        last =
          error instanceof YouTubeStreamError
            ? error
            : new YouTubeStreamError(String(error));
        if (
          last.code !== "YOUTUBE_TRANSIENT" ||
          attempt === config.YOUTUBE_MAX_RETRIES
        )
          throw last;
        const delay = Math.min(1_000 * 2 ** attempt, 10_000);
        console.warn(
          `[YouTube] transient failure; retry ${attempt + 1}/${config.YOUTUBE_MAX_RETRIES} in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw last ?? new YouTubeStreamError("YouTube extraction failed.");
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
        const code = classify(stderr || message);
        if (code === "YOUTUBE_AUTH_REQUIRED")
          console.error(
            "[YouTube] Authentication rejected; renew the local Netscape cookie file.",
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
      if (code !== 0 && code !== null)
        console.error(
          `[YouTube] yt-dlp failed during playback (${url}, code ${code}): ${stderr().trim()}`,
        );
    });
  }

  private transcode(source: Readable, url: string): Readable {
    if (!ffmpegPath)
      throw new YouTubeStreamError("FFmpeg binary is unavailable.");
    const args = ["-loglevel", "error", "-i", "-", "-vn"];
    if (this.options.seek > 0) args.push("-ss", String(this.options.seek));
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
    ffmpeg.once("close", (code) => {
      if (code !== 0 && !output.destroyed)
        output.destroy(
          new Error(
            `FFmpeg failed for ${url} (code ${code}): ${stderr.trim()}`,
          ),
        );
    });
    source.once("error", (error) => output.destroy(error));
    source.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(output);
    output.once("close", () => {
      source.destroy();
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
    if (config.YOUTUBE_COOKIES_PATH) {
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
      return /^(?:www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(
        new URL(value).hostname,
      );
    } catch {
      return false;
    }
  }
  private static getYtDlpPath(): string {
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
  private static async ensureYtDlpExists(): Promise<void> {
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
export default YouTubeStreamConverter;
