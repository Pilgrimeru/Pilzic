import YouTube, { type Video } from 'youtube-sr';
import { NothingFoundError } from '../../errors/ExtractionErrors.js';
import type { PlaylistData } from '../../types/extractor/PlaylistData.js';
import type { TrackData } from '../../types/extractor/TrackData.js';
import { SearchExtractor } from './abstract/SearchExtractor.js';
import { YouTubeLinkExtractor } from './YouTubeLinkExtractor.js';

export class YouTubeSearchExtractor extends SearchExtractor {

  public async searchMultipleTracks(limit: number): Promise<TrackData[]> {
    const results = await YouTube.search(this.query, { limit, type: "video", safeSearch: true });
  
    const trackPromises = results.map(video =>
      this.formatYoutubeVideoToTrackData(video).catch(() => undefined)
    );

    const tracks = await Promise.all(trackPromises);
  
    return tracks.filter((data): data is TrackData => data !== undefined);
  }
  

  public async searchMultiplePlaylists(limit: number, fetch: boolean = false): Promise<PlaylistData[]> {
    const results = await YouTube.search(this.query, { limit, type: "playlist", safeSearch: true });

    const playlistPromises = results.map(async (playlist) => {
      try {
        if (!playlist?.url) {
          throw new NothingFoundError();
        }
        if (fetch) {
          const extractor = new YouTubeLinkExtractor(playlist.url, "playlist");
          return await extractor.extract("playlist");
        } else {
          return { title: playlist.title, url: playlist.url, tracks: [], duration: 0};
        }
        
      } catch (error) {
        console.error(`Erreur lors de l'extraction de la playlist ${playlist.url}:`, error);
        return undefined;
      }
    });

    const playlistsData = await Promise.all(playlistPromises);

    return playlistsData.filter((data): data is PlaylistData => data !== undefined);
  }

  public async searchTrack(): Promise<TrackData> {
    let trackInfo = await YouTube.searchOne(this.query, "video", true).catch(console.error);
    if (!trackInfo || !trackInfo.title) {
      throw new NothingFoundError();
    }

    return this.formatYoutubeVideoToTrackData(trackInfo);
  }

  public async searchPlaylist(): Promise<PlaylistData> {
    const result = await YouTube.searchOne(this.query, "playlist", true);
    if (!result.url) {
      throw new NothingFoundError();
    }
    const youTubeExtractor = new YouTubeLinkExtractor(result.url, "playlist");
    return youTubeExtractor.extract("playlist");
  }

  private async formatYoutubeVideoToTrackData(video: Video): Promise<TrackData> {
    return {
      url: video.url,
      title: video.title!,
      duration: video.duration,
      thumbnail: video.thumbnail?.url!,
    };
  }
}
