import { LRUCache } from 'lru-cache';
import { config } from 'config';
import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';

type CacheKey = string;
type CacheValue = TrackData | PlaylistData;

class CacheManager {
  
  private cache: LRUCache<CacheKey, CacheValue>;
  private maxSize: number;
  private ttl: number;

  constructor(maxSizeInMB = 50, ttlInHours = 12) {
    this.maxSize = maxSizeInMB * 1024 * 1024;
    this.ttl = ttlInHours * 60 * 60 * 1000;

    this.cache = new LRUCache<CacheKey, CacheValue>({
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

  public get(key: CacheKey): CacheValue | undefined {
    return this.cache.get(key);
  }

  public set(key: CacheKey, value: CacheValue): void {
    if (this.maxSize === 0) return;
    this.cache.set(key, value);
  }

  public has(key: CacheKey): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager(config.CACHE_SIZE);
export default cacheManager;