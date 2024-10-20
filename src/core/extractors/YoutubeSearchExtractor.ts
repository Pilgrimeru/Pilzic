import YouTube from 'youtube-sr';
import { NothingFoundError } from '../../errors/ExtractionErrors.js';
import type { PlaylistData } from '../../types/extractor/PlaylistData.js';
import type { TrackData } from '../../types/extractor/TrackData.js';
import { SearchExtractor } from './abstract/SearchExtractor.js';
import { YouTubeLinkExtractor } from './YouTubeLinkExtractor.js';

export class YouTubeSearchExtractor extends SearchExtractor {
    protected async searchTrack(): Promise<TrackData> {
        let songInfo = await YouTube.searchOne(this.query, "video", true).catch(console.error);
      if (!songInfo || !songInfo.title) {
        throw new NothingFoundError();
      }

      return {
        url: songInfo.url,
        title: songInfo.title,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail?.url!,
      };
    }
    protected async searchPlaylist(): Promise<PlaylistData> {
      const result = await YouTube.searchOne(this.query, "playlist", true);
      if (!result.url) {
        throw new NothingFoundError();
      }
     const youTubeExtractor = new YouTubeLinkExtractor(result.url, "playlist")
     return youTubeExtractor.extract("playlist");
    }
}
