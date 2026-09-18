import { config } from "config";
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { utimes } from "node:fs/promises";
import path from "node:path";
import { PassThrough, type Readable } from "node:stream";

const MIN_CACHE_BYTES = 1_024;

class AudioCacheManager {
  private readonly directory = path.resolve(process.cwd(), "cache", "audio");
  private readonly pending = new Map<string, Promise<string | null>>();
  private activePreloads = 0;
  private readonly preloadQueue: Array<() => void> = [];
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    mkdirSync(this.directory, { recursive: true });
    if (this.enabled) this.scheduleCleanup();
  }

  public get enabled(): boolean {
    return config.AUDIO_CACHE_MAX_FILES > 0 && config.AUDIO_CACHE_MAX_MB > 0;
  }

  public get(url: string): string | null {
    if (!this.enabled) return null;
    const target = this.pathFor(url);
    try {
      const stat = statSync(target);
      if (stat.size < MIN_CACHE_BYTES) {
        unlinkSync(target);
        return null;
      }
      const now = new Date();
      void utimes(target, now, now).catch(() => undefined);
      return target;
    } catch {
      return null;
    }
  }

  public open(url: string): Readable | null {
    const target = this.get(url);
    return target ? createReadStream(target) : null;
  }

  public tee(url: string, source: Readable): Readable {
    const playback = new PassThrough();
    const cacheBranch = new PassThrough();
    const temporary = `${this.pathFor(url)}.${process.pid}.${Date.now()}.tmp`;
    source.pipe(playback);
    source.pipe(cacheBranch);
    const writer = createWriteStream(temporary);
    cacheBranch.pipe(writer);
    writer.once("finish", () => {
      try {
        if (statSync(temporary).size >= MIN_CACHE_BYTES)
          renameSync(temporary, this.pathFor(url));
        else unlinkSync(temporary);
        this.scheduleCleanup();
      } catch (error) {
        console.warn("[AudioCache] Could not commit cache entry:", error);
      }
    });
    writer.once("error", () => this.safeUnlink(temporary));
    source.once("error", () => this.safeUnlink(temporary));
    source.once("close", () => {
      if (!source.readableEnded) this.safeUnlink(temporary);
    });
    playback.once("close", () => {
      if (!source.readableEnded) source.destroy();
    });
    return playback;
  }

  public preload(
    url: string,
    producer: () => Promise<Readable>,
  ): Promise<string | null> {
    if (!this.enabled) return Promise.resolve(null);
    const cached = this.get(url);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(url);
    if (existing) return existing;
    const task = new Promise<string | null>((resolve) => {
      this.preloadQueue.push(
        () => void this.runPreload(url, producer).then(resolve),
      );
      this.drain();
    }).finally(() => this.pending.delete(url));
    this.pending.set(url, task);
    return task;
  }

  private async runPreload(
    url: string,
    producer: () => Promise<Readable>,
  ): Promise<string | null> {
    this.activePreloads++;
    const temporary = `${this.pathFor(url)}.${process.pid}.${Date.now()}.tmp`;
    try {
      const source = await producer();
      await new Promise<void>((resolve, reject) => {
        const writer = createWriteStream(temporary);
        source.pipe(writer).once("finish", resolve).once("error", reject);
        source.once("error", reject);
      });
      if (statSync(temporary).size < MIN_CACHE_BYTES)
        throw new Error("Preloaded stream is too small");
      renameSync(temporary, this.pathFor(url));
      this.scheduleCleanup();
      return this.pathFor(url);
    } catch (error) {
      this.safeUnlink(temporary);
      console.warn(`[AudioCache] Preload failed for ${url}:`, error);
      return null;
    } finally {
      this.activePreloads--;
      this.drain();
    }
  }

  private drain(): void {
    while (
      this.preloadQueue.length > 0 &&
      this.activePreloads < Math.max(1, config.AUDIO_PRELOAD_CONCURRENCY)
    )
      this.preloadQueue.shift()?.();
  }

  private cleanup(): void {
    const files = readdirSync(this.directory)
      .filter((name) => name.endsWith(".opus"))
      .map((name) => ({
        path: path.join(this.directory, name),
        stat: statSync(path.join(this.directory, name)),
      }))
      .sort((a, b) => a.stat.atimeMs - b.stat.atimeMs);
    let bytes = files.reduce((sum, file) => sum + file.stat.size, 0);
    while (
      files.length > config.AUDIO_CACHE_MAX_FILES ||
      bytes > config.AUDIO_CACHE_MAX_MB * 1024 * 1024
    ) {
      const oldest = files.shift();
      if (!oldest) break;
      bytes -= oldest.stat.size;
      this.safeUnlink(oldest.path);
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined;
      this.cleanup();
    }, 250);
    this.cleanupTimer.unref?.();
  }

  private pathFor(url: string): string {
    return path.join(
      this.directory,
      `${createHash("md5").update(url).digest("hex")}.opus`,
    );
  }
  private safeUnlink(target: string): void {
    if (existsSync(target))
      try {
        unlinkSync(target);
      } catch {}
  }
}

export const audioCacheManager = new AudioCacheManager();
