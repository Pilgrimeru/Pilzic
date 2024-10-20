import { LRUCache } from 'lru-cache';
import type { PlaylistData } from '../../types/extractor/PlaylistData';
import type { TrackData } from '../../types/extractor/TrackData';

type CacheKey = string;
type CacheValue = TrackData | PlaylistData;

class CacheManager {
  private cache: LRUCache<CacheKey, CacheValue>;
  private maxSize: number;
  private maxEntrySize: number;
  private ttl: number;

  constructor(maxSize = 50 * 1024 * 1024, maxEntrySize = 5 * 1024 * 1024, ttl = 12 * 60 * 60 * 1000) {
    this.maxSize = maxSize;
    this.maxEntrySize = maxEntrySize;
    this.ttl = ttl;

    this.cache = new LRUCache<CacheKey, CacheValue>({
      max: 100,
      maxSize: this.maxSize,
      sizeCalculation: this.calculateSize.bind(this),
      ttl: this.ttl,
      ttlAutopurge: true 
    });
  }

  private calculateSize(value: CacheValue): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }

  public isTooLarge(value: CacheValue): boolean {
    return this.calculateSize(value) > this.maxEntrySize;
  }

  public get(key: CacheKey): CacheValue | undefined {
    return this.cache.get(key);
  }

  public set(key: CacheKey, value: CacheValue): void {
    if (this.isTooLarge(value)) {
      return;
    }

    this.cache.set(key, value);
  }

  public has(key: CacheKey): boolean {
    return this.cache.has(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

const cacheManager = new CacheManager();
export default cacheManager;