import { cacheManager } from "@core/managers/CacheManager";
import { coreMetrics } from "@core/helpers/CoreMetrics";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";

export abstract class Extractor {
  private static readonly pending = new Map<
    string,
    Promise<TrackData | PlaylistData>
  >();
  public readonly type: "track" | "playlist";

  protected constructor(type: "track" | "playlist") {
    this.type = type;
  }

  public static async validate(
    _url: string,
  ): Promise<"track" | "playlist" | boolean> {
    throw new Error("Must be implemented by subclass");
  }

  public async extract(): Promise<TrackData | PlaylistData>;
  public async extract(type: "track"): Promise<TrackData>;
  public async extract(type: "playlist"): Promise<PlaylistData>;
  public async extract(): Promise<TrackData | PlaylistData> {
    const cacheKey = this.getCacheKey();
    const cached = cacheManager.get(cacheKey);
    if (cached) return cached;
    const pending = Extractor.pending.get(cacheKey);
    if (pending) return pending.then((data) => structuredClone(data));

    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Metadata extraction timed out")),
        45_000,
      );
    });
    const startedAt = performance.now();
    const extraction = Promise.race([this.fetchData(), timeout])
      .then((data) => {
        cacheManager.set(cacheKey, data);
        return data;
      })
      .finally(() => {
        coreMetrics.recordPhase("metadata", performance.now() - startedAt);
        clearTimeout(timer);
        Extractor.pending.delete(cacheKey);
      });
    Extractor.pending.set(cacheKey, extraction);
    return extraction.then((data) => structuredClone(data));
  }

  protected abstract getCacheKey(): string;
  protected abstract fetchData(): Promise<TrackData | PlaylistData>;
}
