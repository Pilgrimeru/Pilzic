import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import { Extractor } from './Extractor';

export abstract class LinkExtractor extends Extractor {

  protected readonly url: string;

  constructor(url: string, type: 'track' | 'playlist') {
    super(type);
    this.url = url;
  }

  public static override async validate(_url: string): Promise<'track' | 'playlist' | false> {
    throw new Error("Must be implemented by subclass");
  }

  protected getCacheKey(): string {
    return `${this.type}:link:${this.url}`;
  }

  protected async fetchData(): Promise<TrackData | PlaylistData> {
    if (this.type === 'track') {
      return this.extractTrack();
    } else {
      return this.extractPlaylist();
    }
  }

  protected abstract extractTrack(): Promise<TrackData>;
  protected abstract extractPlaylist(): Promise<PlaylistData>;
}
