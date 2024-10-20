import YouTube from 'youtube-sr';
import { config } from "../../config.js";
import type { TrackData } from '../../types/extractor/TrackData.js';
import type { PlaylistData } from '../../types/extractor/PlaylistData.js';
import { SearchExtractor } from './SearchExtractor.js';
import { NothingFoundError } from '../../errors/ExtractionErrors.js';

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
        let playlist = await YouTube.getPlaylist(result.url!, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE
        });
        if (!playlist || !playlist.title || !playlist.url) {
          throw new NothingFoundError();
        }
      

      const songs = await YouTubeSearchExtractor.getTracksDataFromYoutube(playlist.videos);
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.title, url: playlist.url, songs, duration };
    }
}
