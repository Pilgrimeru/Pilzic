
import type { PlaylistData } from "../../types/extractor/PlaylistData";
import type { TrackData } from "../../types/extractor/TrackData";
import { Extractor } from "./Extractor";

export abstract class SearchExtractor extends Extractor {
    protected query: string;
  
    constructor(query: string, type: 'track' | 'playlist') {
        super(type);
      this.query = query;
    }
  
    public static async validate(url: string): Promise<boolean> {
      return !url.match(/^https?:\/\/\S+$/);
    }
  
    public extract(): Promise<TrackData | PlaylistData> {
      if (this.type == 'track') return this.searchTrack();
      return this.searchPlaylist();
    }
  
    protected abstract searchTrack(): Promise<TrackData>;
    protected abstract searchPlaylist(): Promise<PlaylistData>;
  }
  