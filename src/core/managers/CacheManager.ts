import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import { config } from "config";
import { LRUCache } from "lru-cache";

type CacheValue = TrackData | PlaylistData;

class CacheManager {
  private readonly cache: LRUCache<string, CacheValue>;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSizeInMB = 50, ttlInHours = 12) {
    this.maxSize = maxSizeInMB * 1024 * 1024;
    this.ttl = ttlInHours * 60 * 60 * 1000;

    this.cache = new LRUCache<string, CacheValue>({
      max: Math.min(5_000, Math.max(100, Math.ceil(this.maxSize / 2_048))),
      maxSize: this.maxSize,
      sizeCalculation: this.maxSize ? this.calculateSize : undefined,
      ttl: this.ttl,
      ttlAutopurge: true,
    });
  }

  private calculateSize(value: CacheValue): number {
    const fieldSize = (field: string | null | undefined) =>
      (field?.length ?? 0) * 2;
    if ("tracks" in value)
      return (
        256 +
        fieldSize(value.title) +
        fieldSize(value.url) +
        value.tracks.reduce(
          (size, track) =>
            size + 128 + fieldSize(track.title) + fieldSize(track.url),
          0,
        )
      );
    return 128 + fieldSize(value.title) + fieldSize(value.url);
  }

  public get(key: string): CacheValue | undefined {
    const value = this.cache.get(key);
    return value ? structuredClone(value) : undefined;
  }

  public set(key: string, value: CacheValue): void {
    if (this.maxSize === 0) return;
    this.cache.set(key, structuredClone(value));
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager(config.CACHE_SIZE);
export { cacheManager };
