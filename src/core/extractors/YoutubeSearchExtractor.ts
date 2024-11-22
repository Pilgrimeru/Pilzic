import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { NothingFoundError } from '@errors/ExtractionErrors';
import YouTube, { type Video } from 'youtube-sr';
import { SearchExtractor } from './abstract/SearchExtractor';
import { YouTubeLinkExtractor } from './YouTubeLinkExtractor';

export class YouTubeSearchExtractor extends SearchExtractor {

  public async searchMultipleTracks(limit: number): Promise<TrackData[]> {
    const results = await YouTube.search(this.query, { limit, type: "video" });

    const trackPromises = results.map(video =>
      this.formatYoutubeVideoToTrackData(video).catch(() => undefined)
    );

    const tracks = await Promise.all(trackPromises);

    return tracks.filter((data): data is TrackData => data !== undefined);
  }

  public async searchMultiplePlaylists(limit: number, fetch: boolean = false): Promise<PlaylistData[]> {
    const results = await YouTube.search(this.query, { limit, type: "playlist" });

    const playlistPromises = results.map(async (playlist) => {
      try {
        if (!playlist?.url || !playlist?.title) {
          throw new NothingFoundError();
        }
        if (fetch) {
          const extractor = new YouTubeLinkExtractor(playlist.url, "playlist");
          return await extractor.extract("playlist");
        } else {
          return { title: playlist.title, url: playlist.url, tracks: [], duration: 0 };
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
    const trackInfo = await YouTube.searchOne(this.query, "video").catch(console.error);
    if (!trackInfo || !trackInfo.title) {
      throw new NothingFoundError();
    }

    return this.formatYoutubeVideoToTrackData(trackInfo);
  }

  public async searchPlaylist(fetch: boolean = false): Promise<PlaylistData> {
    const result = await YouTube.searchOne(this.query, "playlist");
    if (!result?.url || !result?.title) {
      throw new NothingFoundError();
    }
    if (fetch) {
      const extractor = new YouTubeLinkExtractor(result.url, "playlist");
      return await extractor.extract("playlist");
    } else {
      return { title: result.title, url: result.url, tracks: [], duration: 0 };
    }
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
