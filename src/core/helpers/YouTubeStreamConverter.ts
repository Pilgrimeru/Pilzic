import { spawn } from "child_process";
import { config } from "config";
import ffmpegPath from "ffmpeg-static";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import got from "got";
import * as nodePath from "path";
import * as process from "process";
import type { Readable } from "stream";
import { URL } from "url";

/**
 * Configuration options for the YouTube stream converter
 */
export interface StreamConverterOptions {
  /**
   * Format selection string for yt-dlp.
   * Defaults to 'bestaudio[ext=opus]/bestaudio'.
   * This prioritizes opus for better Discord.js/voice compatibility.
   */
  format?: string;
  /**
   * Rate limit for downloads (in bytes per second), e.g., "500K" or "1M".
   * Consider adjusting based on your bot's bandwidth and server load.
   * @default "100K"
   */
  limitRate?: string;
  /**
   * Whether to suppress yt-dlp's output.
   * Set to `true` for standard bot operation.
   * @default true
   */
  quiet?: boolean;
  /**
   * Additional yt-dlp arguments as a string array.
   * Useful for advanced customization (e.g., proxy, specific extractors).
   * @default []
   */
  additionalArgs?: string[];
  /**
   * Whether to disable TLS fingerprinting impersonation.
   * Useful if you encounter issues with "Signature Too Old" or similar.
   * @default false
   */
  noImpersonate?: boolean;
  /**
   * Optional seek position (in seconds) to start the stream from.
   * If set, the stream will start from this position.
   */
  seek?: number;
}

/**
 * Error thrown when YouTube stream extraction fails
 */
export class YouTubeStreamError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = "YouTubeStreamError";
  }
}

/**
 * YouTube Stream Converter
 *
 * Provides functionality to convert YouTube URLs into audio streams
 * compatible with discord.js/voice using yt-dlp.
 */
export class YouTubeStreamConverter {
  private static readonly YTDLP_PATH: string = YouTubeStreamConverter.getYtDlpPath();
  private readonly options: Required<StreamConverterOptions>;

  /**
   * Creates a new YouTube Stream Converter instance
   *
   * @param options - Configuration options for the converter
   */
  constructor(options: StreamConverterOptions = {}) {
    this.options = {
      format: options.format ?? "bestaudio[ext=opus]/bestaudio",
      limitRate: options.limitRate ?? "100K",
      quiet: options.quiet ?? true,
      additionalArgs: options.additionalArgs ?? [],
      noImpersonate: options.noImpersonate ?? false,
      seek: options.seek ?? 0,
    };
  }

  /**
   * Gets the YouTube stream as a readable stream suitable for discord.js/voice.
   * This method returns a stream that can be used with `createAudioResource`
   * and `StreamType.OggOpus` for optimal discord.js/voice compatibility.
   *
   * @param url - The YouTube URL to extract audio from.
   * @returns A readable stream containing the audio data.
   * @throws {YouTubeStreamError} When stream extraction fails.
   *
   * @example
   * ```typescript
   * import { createAudioResource, StreamType } from '@discordjs/voice';
   * const converter = new YouTubeStreamConverter();
   * try {
   *   const stream = await converter.getYouTubeStream("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
   *   const resource = createAudioResource(stream, {
   *     inputType: StreamType.OggOpus, // Crucial for performance
   *     inlineVolume: true // Optional
   *   });
   *   // ... play resource
   * } catch (error) {
   *   console.error("Error getting YouTube stream:", error);
   * }
   * ```
   */
  async getYouTubeStream(url: string): Promise<Readable> {
    if (!this.isValidYouTubeUrl(url)) {
      throw new YouTubeStreamError(`Invalid YouTube URL provided: ${url}`);
    }

    try {
      return await this.getStreamWithYtDlp(url);
    } catch (error) {
      throw new YouTubeStreamError(
        `Failed to extract stream from YouTube URL: ${url}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Validates if a URL is a valid YouTube URL.
   * @param url - The URL to validate.
   * @returns True if the URL is a valid YouTube URL.
   */
  private isValidYouTubeUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const host = urlObj.hostname;
      return (
        host === "www.youtube.com" ||
        host === "youtube.com" ||
        host === "youtu.be" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com"
      );
    } catch {
      return false;
    }
  }

  /**
   * Gets stream using yt-dlp.
   * @param url The YouTube URL.
   * @returns A Readable stream.
   */
  private async getStreamWithYtDlp(url: string): Promise<Readable> {
    await YouTubeStreamConverter.ensureYtDlpExists();

    return new Promise((resolve, reject) => {
      const args: string[] = this.buildYtDlpArgs(url);

      const streamProcess = spawn(YouTubeStreamConverter.YTDLP_PATH, args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stderrOutput = "";
      streamProcess.stderr?.on("data", (data) => {
        stderrOutput += data.toString();
        if (!this.options.quiet) {
          console.error(`[yt-dlp stderr] ${data.toString().trim()}`);
        }
      });

      if (!streamProcess.stdout) {
        reject(new YouTubeStreamError("Failed to get stdout pipe from yt-dlp process."));
        return;
      }

      streamProcess.on("spawn", () => {
        resolve(streamProcess.stdout);
      });

      streamProcess.on("error", (error: Error) => {
        reject(new YouTubeStreamError(
          `yt-dlp process failed to start or encountered an internal error: ${error.message} (stderr: ${stderrOutput.trim()})`,
          error
        ));
      });

      streamProcess.on("close", (code) => {
        if (code !== 0 && code !== null) {
          reject(new YouTubeStreamError(
            `yt-dlp process exited with code ${code}. (stderr: ${stderrOutput.trim()})`
          ));
        }
      });
    });
  }

  /**
   * Builds yt-dlp arguments for stream extraction.
   * Centralizes argument logic to avoid redundancy.
   * @param url The YouTube URL.
   * @returns Array of yt-dlp arguments.
   */
  private buildYtDlpArgs(url: string): string[] {
    const acceptLanguage = "en-US,en;q=0.9";
    const referer = "https://www.youtube.com/";
    const fakeCookie = `PREF=f${Math.floor(Math.random() * 100000)}; YSC=${Math.random().toString(36).substring(2, 18)}; VISITOR_INFO1_LIVE=${Math.random().toString(36).substring(2, 13)}`;

    const args: string[] = [
      url,
      "--output", "-",
      "--format", this.options.format,
      "--no-playlist",
      "--retries", "infinite",
      "--youtube-skip-dash-manifest",
      "--no-warnings",
      "--user-agent", config.USERAGENT,
      "--add-header", `Accept-Language:${acceptLanguage}`,
      "--add-header", `Referer:${referer}`,
      "--add-header", `Cookie:${fakeCookie}`,
      "--extractor-args", "youtube:client=android",
      ...this.options.additionalArgs,
    ];

    if (ffmpegPath) {
      args.push("--ffmpeg-location", ffmpegPath);
    }

    const seek = this.options.seek;
    if (typeof seek === "number" && !isNaN(seek) && seek > 0) {
      args.push("--download-sections", `*${seek}-`);
    }

    if (this.options.quiet) {
      args.push("--quiet");
    }
    if (this.options.limitRate) {
      args.push("--limit-rate", this.options.limitRate);
    }
    if (this.options.noImpersonate) {
      args.push("--impersonate", "");
    }
    return args;
  }

  /**
   * Determines the platform-specific suffix for the yt-dlp executable.
   * @returns {string} The platform-specific suffix.
   */
  private static getPlatformSuffix(): string {
    if (process.platform === "win32") return ".exe";
    if (process.platform === "darwin") return "_macos";
    if (process.platform === "linux") {
      const arch = process.arch;
      if (arch === 'arm64') return '_linux_aarch64';
      if (arch === 'arm') return '_linux_armv7l';
      return '_linux';
    }
    return "";
  }

  /**
   * Gets the path to yt-dlp executable. Tries to find it in `node_modules/.bin` first.
   * @returns {string} The absolute path to the yt-dlp executable.
   */
  private static getYtDlpPath(): string {
    const ext = YouTubeStreamConverter.getPlatformSuffix();
    const filename = `yt-dlp${ext}`;

    const nodeModulesBinPath = nodePath.join(process.cwd(), 'node_modules', '.bin', filename);
    if (existsSync(nodeModulesBinPath)) {
      return nodeModulesBinPath;
    }

    const scriptsPath = nodePath.resolve(process.cwd(), "scripts");
    return nodePath.resolve(scriptsPath, filename);
  }

  /**
   * Ensures yt-dlp executable exists, downloads it if necessary.
   * Includes architecture checks for Linux.
   */
  private static async ensureYtDlpExists(): Promise<void> {
    if (existsSync(this.YTDLP_PATH)) {
      return;
    }

    mkdirSync(nodePath.dirname(this.YTDLP_PATH), { recursive: true });

    let latestRelease: any;
    try {
      latestRelease = await this.fetchJson<any>("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest");
    } catch (error) {
      throw new YouTubeStreamError(
        "Failed to fetch yt-dlp release information from GitHub.",
        error instanceof Error ? error : new Error(String(error))
      );
    }

    const platformSuffix = this.getPlatformSuffix();
    const exeFilename = `yt-dlp${platformSuffix}`;
    const exeAsset = latestRelease.assets.find((ast: any) => ast.name === exeFilename);

    if (!exeAsset) {
      throw new YouTubeStreamError(
        `No yt-dlp binary found for platform ${process.platform} and architecture ${process.arch}.` +
        ` Please ensure the correct binary name exists in the latest release assets. Expected: ${exeFilename}`
      );
    }

    console.info(`[INFO] Downloading yt-dlp binary from ${exeAsset.browser_download_url} to ${this.YTDLP_PATH}`);
    try {
      await this.downloadFile(exeAsset.browser_download_url, this.YTDLP_PATH);
    } catch (error) {
      throw new YouTubeStreamError(
        `Failed to download yt-dlp binary: ${error}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }

    if (process.platform !== "win32") {
      try {
        await import("fs/promises").then(async fs => {
          try {
            await fs.chmod(this.YTDLP_PATH, 0o755);
          } catch (chmodErr: any) {
            if (chmodErr && chmodErr.code === "EACCES") {
              try {
                const uid = process.getuid?.();
                const gid = process.getgid?.();
                if (typeof uid === "number" && typeof gid === "number") {
                  await fs.chown(this.YTDLP_PATH, uid, gid);
                  await fs.chmod(this.YTDLP_PATH, 0o755);
                }
              } catch { }
            } else {
              throw chmodErr;
            }
          }
        });
      } catch (error) {
        throw new YouTubeStreamError(
          `Failed to set executable permissions for yt-dlp: ${error}`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }

    if (!existsSync(this.YTDLP_PATH)) {
      throw new YouTubeStreamError("yt-dlp binary was not found after download and permission setting.");
    }
    console.info("[INFO] Successfully downloaded and set up yt-dlp.");
  }


  /**
   * Fetches JSON data from a URL using https.
   * Using 'got' instead of 'https' for better error handling and redirects.
   * @param url The URL to fetch JSON from.
   * @returns A Promise that resolves with the parsed JSON data.
   */
  private static async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await got(url).json<T>();
      return response;
    } catch (error) {
      throw new YouTubeStreamError(`Failed to fetch JSON from ${url}: ${error}`, error as Error);
    }
  }

  /**
   * Downloads a file from a URL using got (handles redirects and headers).
   * @param url The URL to download from.
   * @param destination The local path to save the file.
   * @returns A Promise that resolves when the download is complete.
   */
  private static async downloadFile(url: string, destination: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(destination, { mode: 0o777 });
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);

      got.stream(url)
        .on("error", (error) => {
          writeStream.destroy();
          reject(error);
        })
        .pipe(writeStream);
    });
  }
}

/**
 * Default converter instance for convenience
 */
const defaultConverter = new YouTubeStreamConverter();

/**
 * Convenience function to get a YouTube stream using the default converter.
 *
 * @param url - The YouTube URL to extract audio from.
 * @param options - Optional configuration options to override default converter settings.
 * @returns A readable stream containing the audio data.
 */
export async function getYouTubeStream(
  url: string,
  options?: StreamConverterOptions
): Promise<Readable> {
  if (options) {
    const converter = new YouTubeStreamConverter(options);
    return converter.getYouTubeStream(url);
  }
  return defaultConverter.getYouTubeStream(url);
}

export { YouTubeStreamConverter as default };
