import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { InvalidURLError, NoDataError, ServiceUnavailableError } from '@errors/ExtractionErrors';
import { config } from 'config';
import { so_validate, soundcloud, SoundCloudTrack } from 'play-dl';
import { LinkExtractor } from './abstract/LinkExtractor';

export class SoundCloudLinkExtractor extends LinkExtractor {

  private static readonly SO_LINK = /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(api\.soundcloud\.com|soundcloud\.com|snd\.sc)\/.+$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(SoundCloudLinkExtractor.SO_LINK)) {
      const result = await so_validate(url);
      if (result == "search") return false;
      return result;
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      let trackInfo = (await soundcloud(this.url)) as SoundCloudTrack;

      return {
        url: trackInfo.url,
        title: trackInfo.name,
        duration: trackInfo.durationInMs,
        thumbnail: trackInfo.thumbnail,
      };
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {

      const playlist = await soundcloud(this.url);
      if (!playlist || playlist instanceof SoundCloudTrack) {
        throw new NoDataError();
      }
      const playlistTracks = await playlist.all_tracks();

      const tracks = await SoundCloudLinkExtractor.buildTracksData(playlistTracks);
      const duration = tracks.reduce((total, track) => total + track.duration, 0);

      return { title: playlist.name, url: this.url, tracks: tracks, duration };
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  protected static async buildTracksData(tracks: SoundCloudTrack[]): Promise<TrackData[]> {
    if (!tracks.length) {
      throw new NoDataError();
    }

    return tracks.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((track) => ({
      url: track.permalink,
      title: track.name,
      duration: track.durationInMs,
      thumbnail: track.thumbnail,
    }));
  }
}
