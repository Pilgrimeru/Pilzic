import { config } from "config";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, type Stats } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { normalizeUrl } from "../helpers/normalizeInput";

const MIN_CACHE_BYTES = 1_024;

class AudioCacheManager {
  private readonly directory = path.resolve(process.cwd(), "cache", "audio");
  private readonly ready = mkdir(this.directory, { recursive: true });
  private readonly pending = new Map<string, Promise<string | null>>();
  private activePreloads = 0;
  private readonly preloadQueue: Array<() => void> = [];
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly touchedAt = new Map<string, number>();
  private hits = 0;
  private misses = 0;

  constructor() {
    if (this.enabled) this.scheduleCleanup();
  }

  public get enabled(): boolean {
    return config.AUDIO_CACHE_MAX_FILES > 0 && config.AUDIO_CACHE_MAX_MB > 0;
  }

  public async get(url: string): Promise<string | null> {
    if (!this.enabled) return null;
    await this.ready;
    const target = this.pathFor(url);
    try {
      const info = await stat(target);
      if (info.size < MIN_CACHE_BYTES) {
        this.misses++;
        await rm(target, { force: true });
        return null;
      }
      this.hits++;
      const now = Date.now();
      if (now - (this.touchedAt.get(target) ?? 0) > 60_000) {
        if (
          this.touchedAt.size > Math.max(100, config.AUDIO_CACHE_MAX_FILES * 2)
        )
          this.touchedAt.clear();
        this.touchedAt.set(target, now);
        void utimes(target, new Date(now), new Date(now)).catch(
          () => undefined,
        );
      }
      return target;
    } catch {
      this.misses++;
      return null;
    }
  }

  public snapshot(): {
    hits: number;
    misses: number;
    pending: number;
    activePreloads: number;
  } {
    return {
      hits: this.hits,
      misses: this.misses,
      pending: this.pending.size,
      activePreloads: this.activePreloads,
    };
  }

  public async open(url: string): Promise<Readable | null> {
    const target = await this.get(url);
    return target ? createReadStream(target) : null;
  }

  public preload(
    url: string,
    producer: () => Promise<Readable>,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (!this.enabled || signal?.aborted) return Promise.resolve(null);
    const key = this.keyFor(url);
    const existing = this.pending.get(key);
    if (existing) return existing;
    const maxQueued = Math.max(
      config.AUDIO_PRELOAD_CONCURRENCY * 4,
      config.AUDIO_PRELOAD_COUNT * 4,
    );
    if (this.preloadQueue.length >= maxQueued) return Promise.resolve(null);
    const task = new Promise<string | null>((resolve) => {
      this.preloadQueue.push(() => {
        void this.runPreload(url, producer, signal).then(resolve);
      });
      this.drain();
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, task);
    return task;
  }

  private async runPreload(
    url: string,
    producer: () => Promise<Readable>,
    signal?: AbortSignal,
  ): Promise<string | null> {
    this.activePreloads++;
    const temporary = `${this.pathFor(url)}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await this.ready;
      if (signal?.aborted) return null;
      const cached = await this.get(url);
      if (cached) return cached;
      const source = await producer();
      const writer = createWriteStream(temporary);
      const abort = () => {
        source.destroy(signal?.reason);
        writer.destroy(signal?.reason);
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        if (signal?.aborted) abort();
        await pipeline(source, writer);
      } finally {
        signal?.removeEventListener("abort", abort);
      }
      if ((await stat(temporary)).size < MIN_CACHE_BYTES) return null;
      await rename(temporary, this.pathFor(url));
      this.scheduleCleanup();
      return this.pathFor(url);
    } catch (error) {
      if (!signal?.aborted) console.warn("[AudioCache] Preload failed:", error);
      return null;
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
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

  private async cleanup(): Promise<void> {
    await this.ready;
    const allNames = await readdir(this.directory);
    for (const name of allNames.filter((entry) => entry.endsWith(".tmp"))) {
      const temporary = path.join(this.directory, name);
      try {
        if (Date.now() - (await stat(temporary)).mtimeMs > 60 * 60 * 1000)
          await rm(temporary, { force: true });
      } catch {
        /* Another job may have removed it. */
      }
    }
    const names = allNames.filter((name) => name.endsWith(".opus"));
    const files = (
      await Promise.all(
        names.map(async (name) => {
          const filePath = path.join(this.directory, name);
          try {
            return { path: filePath, info: await stat(filePath) };
          } catch {
            return null;
          }
        }),
      )
    )
      .filter((file): file is { path: string; info: Stats } => file !== null)
      .sort((a, b) => a.info.atimeMs - b.info.atimeMs);
    let bytes = files.reduce((sum, file) => sum + file.info.size, 0);
    while (
      files.length > config.AUDIO_CACHE_MAX_FILES ||
      bytes > config.AUDIO_CACHE_MAX_MB * 1024 * 1024
    ) {
      const oldest = files.shift();
      if (!oldest) break;
      bytes -= oldest.info.size;
      await rm(oldest.path, { force: true }).catch(() => undefined);
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined;
      void this.cleanup().catch((error) =>
        console.warn("[AudioCache] Cleanup failed:", error),
      );
    }, 250);
    this.cleanupTimer.unref?.();
  }

  private keyFor(url: string): string {
    try {
      const parsed = new URL(url);
      const id =
        parsed.hostname === "youtu.be"
          ? parsed.pathname.slice(1)
          : parsed.searchParams.get("v");
      if (id && /(?:youtube\.com|youtu\.be)$/.test(parsed.hostname))
        return `youtube:${id}`;
      return normalizeUrl(url);
    } catch {
      return url;
    }
  }

  private pathFor(url: string): string {
    return path.join(
      this.directory,
      `${createHash("sha256").update(this.keyFor(url)).digest("hex")}.opus`,
    );
  }
}

export const audioCacheManager = new AudioCacheManager();
