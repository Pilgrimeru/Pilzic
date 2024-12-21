import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { config } from 'config';
import { LRUCache } from 'lru-cache';

type CacheValue = TrackData | PlaylistData;

class CacheManager {

  private readonly cache: LRUCache<string, CacheValue>;
  private readonly maxSize: number;
  private readonly ttl: number;

  constructor(maxSizeInMB = 50, ttlInHours = 12) {
    this.maxSize = maxSizeInMB * 1024 * 1024;
    this.ttl = ttlInHours * 60 * 60 * 1000;

    this.cache = new LRUCache<string, CacheValue>({
      max: 100,
      maxSize: this.maxSize,
      sizeCalculation: this.maxSize ? this.calculateSize : undefined,
      ttl: this.ttl,
      ttlAutopurge: true
    });
  }

  private calculateSize(value: CacheValue): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  public get(key: string): CacheValue | undefined {
    return this.cache.get(key);
  }

  public set(key: string, value: CacheValue): void {
    if (this.maxSize === 0) return;
    this.cache.set(key, value);
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager(config.CACHE_SIZE);
export { cacheManager };

