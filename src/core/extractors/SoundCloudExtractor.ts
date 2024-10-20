import { LinkExtractor } from './LinkExtractor';
import { so_validate, soundcloud, SoundCloudPlaylist, SoundCloudTrack } from 'play-dl';
import { InvalidURLError, NoDataError, ServiceUnavailableError } from '../../errors/ExtractionErrors';
import type { TrackData } from '../../types/extractor/TrackData';
import type { PlaylistData } from '../../types/extractor/PlaylistData';

export class SoundCloudExtractor extends LinkExtractor {

  private static readonly SO_LINK = /^(?:(https?):\/\/)?(?:(?:www|m)\.)?(api\.soundcloud\.com|soundcloud\.com|snd\.sc)\/.+$/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(SoundCloudExtractor.SO_LINK)) {
      let result = await so_validate(url);
      if (result == "search") return false;
      return result;
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      let songInfo = (await soundcloud(this.url)) as SoundCloudTrack;

      return {
        url: songInfo.url,
        title: songInfo.name,
        duration: songInfo.durationInMs,
        thumbnail: songInfo.thumbnail,
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
      let tracks: SoundCloudTrack[] = [];

      let playlist = await soundcloud(url);
      if (!playlist) {
        throw new NoDataError();
      }

      if (playlist.type === "playlist") {
        tracks = await (playlist as SoundCloudPlaylist).all_tracks();
      }

      const songs = await SoundCloudExtractor.getTracksDataFromSoundCloud(tracks);
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.name, this.url, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }
}
