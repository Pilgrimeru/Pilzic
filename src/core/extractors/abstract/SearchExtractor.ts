
import type { PlaylistData } from "../../../types/extractor/PlaylistData";
import type { TrackData } from "../../../types/extractor/TrackData";
import { Extractor } from "./Extractor";

export abstract class SearchExtractor extends Extractor {
  protected readonly query: string;

  constructor(query: string, type: 'track' | 'playlist') {
    super(type);
    this.query = query;
  }

  public static override async validate(query: string): Promise<boolean> {
    return !query.match(/^https?:\/\/\S+$/);
  }

  protected getCacheKey(): string {
    return `${this.type}:search:${this.query}`;
  }

  protected async fetchData(): Promise<TrackData | PlaylistData> {
    if (this.type === 'track') {
      return this.searchTrack();
    } else {
      return this.searchPlaylist();
    }
  }

  public abstract searchTrack(): Promise<TrackData>;
  public abstract searchPlaylist(): Promise<PlaylistData>;

  public abstract searchMultipleTracks(limit: number): Promise<TrackData[]>;
  public abstract searchMultiplePlaylists(limit: number, fetch: boolean): Promise<PlaylistData[]>;
}
  