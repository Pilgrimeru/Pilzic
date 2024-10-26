import axios from 'axios';
import { deezer, DeezerAlbum, DeezerPlaylist, DeezerTrack, dz_validate } from 'play-dl';
import { InvalidURLError, NoDataError, ServiceUnavailableError } from '@errors/ExtractionErrors';
import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { DataFinder } from '@core/helpers/DataFinder';
import { LinkExtractor } from './abstract/LinkExtractor';

export class DeezerLinkExtractor extends LinkExtractor {
  
  private static readonly DZ_LINK = /^https?:\/\/(?:www\.)?(?:deezer\.com|deezer\.page\.link)\/?.+/;

  public static override async validate(url: string): Promise<'track' | 'playlist' | false> {
    if (url.match(DeezerLinkExtractor.DZ_LINK)) {
      let response = await axios.head(url).catch(() => null);

      if (!response?.request?._redirectable?._options) return false;

      let path = response.request._redirectable._options.pathname;

      if (!path) return false;

      if (path.match(/^\/(?:\w{2})\/track/)) return "track";
      if (path.match(/^\/(?:\w{2})\/album/)) return "playlist";
      if (path.match(/^\/(?:\w{2})\/playlist/)) return "playlist";
      return false;
    }
    const validate = await dz_validate(url);
    if (validate === 'album') return "playlist";
    if (validate === 'search') return false;
    return validate;
  }

  protected async extractTrack(): Promise<TrackData> {
    let data;
    try {
      data = await deezer(this.url);
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }

    let track: DeezerTrack | undefined;
    if (data && data.type === "track") {
      track = data as DeezerTrack;
    } else {
      throw new NoDataError();
    }
    let search = track.artist.name + " " + track.title;
    return DataFinder.searchTrackData(search);
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      let playlist = await deezer(this.url);

      if (!playlist) {
        throw new NoDataError();
      }
      playlist = (playlist as DeezerPlaylist | DeezerAlbum);

      const promiseTracksData: Promise<TrackData>[] = playlist.tracks.map((track) => {
        const search = track.artist.name + " " + track.title;
        return DataFinder.searchTrackData(search);
      });

      const tracks = await Promise.all(promiseTracksData);
      const duration = tracks.reduce((total, track) => total + track.duration, 0);

      return { title: playlist.title, url: playlist.url, tracks, duration };
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }
}
