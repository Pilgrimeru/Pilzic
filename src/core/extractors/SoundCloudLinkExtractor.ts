import { so_validate, soundcloud, SoundCloudPlaylist, SoundCloudTrack } from 'play-dl';
import { config } from '../../config';
import { InvalidURLError, NoDataError, ServiceUnavailableError } from '../../errors/ExtractionErrors';
import type { PlaylistData } from '../../types/extractor/PlaylistData';
import type { TrackData } from '../../types/extractor/TrackData';
import { LinkExtractor } from './abstract/LinkExtractor';

export class SoundCloudLinkExtractor extends LinkExtractor {

  private static readonly SO_LINK = /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(api\.soundcloud\.com|soundcloud\.com|snd\.sc)\/.+$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(SoundCloudLinkExtractor.SO_LINK)) {
      let result = await so_validate(url);
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
      let scTracks: SoundCloudTrack[] = [];

      let playlist = await soundcloud(this.url);
      if (!playlist) {
        throw new NoDataError();
      }

      if (playlist.type === "playlist") {
        scTracks = await (playlist as SoundCloudPlaylist).all_tracks();
      }

      const tracks = await SoundCloudLinkExtractor.buildTracksData(scTracks);
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
