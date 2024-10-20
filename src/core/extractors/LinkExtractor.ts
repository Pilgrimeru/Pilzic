import type { PlaylistData } from "../../types/extractor/PlaylistData";
import type { TrackData } from "../../types/extractor/TrackData";
import { Extractor } from "./Extractor";
import type { SearchExtractor } from "./SearchExtractor";
import { YouTubeSearchExtractor } from "./YoutubeSearchExtractor";

export abstract class LinkExtractor extends Extractor {
    protected url: string;

    constructor(url: string, type: 'track' | 'playlist') {
      super(type)
      this.url = url;
    }
  
    public static override async validate(_url: string): Promise<'track' | 'playlist' | false> {
      throw new Error("Must be implemented by subclass");
    }

    public extract(): Promise<TrackData | PlaylistData> {
      if (this.type == 'track') return this.extractTrack();
      return this.extractPlaylist();
    }

    public getSearchExtractor(search: string, type: 'track' | 'playlist'): SearchExtractor {
      return new YouTubeSearchExtractor(search, type);
    }
  
    protected abstract extractTrack(): Promise<TrackData>;
    protected abstract extractPlaylist(): Promise<PlaylistData>;
  }
  