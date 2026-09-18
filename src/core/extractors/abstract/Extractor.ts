import { cacheManager } from "@core/managers/CacheManager";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import type { User } from "discord.js";
import type { Playlist } from "@core/Playlist";
import type { Track } from "@core/Track";

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
    if (pending) return pending;

    const extraction = this.fetchData()
      .then((data) => {
        cacheManager.set(cacheKey, data);
        return data;
      })
      .finally(() => Extractor.pending.delete(cacheKey));
    Extractor.pending.set(cacheKey, extraction);
    return extraction;
  }

  protected abstract getCacheKey(): string;
  protected abstract fetchData(): Promise<TrackData | PlaylistData>;

  public async extractAndBuild(requester: User): Promise<Track | Playlist> {
    if (this.type === "track") {
      const { Track: TrackClass } = await import("@core/Track");
      const data = await this.extract("track");
      return TrackClass.from(data, requester);
    } else {
      const { Playlist: PlaylistClass } = await import("@core/Playlist");
      const data = await this.extract("playlist");
      return PlaylistClass.from(data, requester);
    }
  }
}
