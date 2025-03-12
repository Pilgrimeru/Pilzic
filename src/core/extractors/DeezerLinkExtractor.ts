import { DataFinder } from "@core/helpers/DataFinder";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  InvalidURLError,
  NoDataError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import axios from "axios";
import { deezer, DeezerTrack, dz_validate } from "play-dl";
import { LinkExtractor } from "./abstract/LinkExtractor";

export class DeezerLinkExtractor extends LinkExtractor {
  private static readonly DZ_LINK =
    /^https?:\/\/(?:www\.)?(?:deezer\.com|deezer\.page\.link)\/?.+/;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (RegExp(DeezerLinkExtractor.DZ_LINK).exec(url)) {
      const response = await axios.head(url).catch(() => null);

      if (!response?.request?._redirectable?._options) return false;

      const path = response.request._redirectable._options.pathname;

      if (!path) return false;

      if (path.match(/^\/\w{2}\/track/)) return "track";
      if (path.match(/^\/\w{2}\/album/)) return "playlist";
      if (path.match(/^\/\w{2}\/playlist/)) return "playlist";
      return false;
    }
    const validate = await dz_validate(url);
    if (validate === "album") return "playlist";
    if (validate === "search") return false;
    return validate;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const data = await deezer(this.url);
      if (!data || !(data instanceof DeezerTrack)) {
        throw new NoDataError();
      }

      const search = data.artist.name + " " + data.title;
      return DataFinder.searchTrackData(search);
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      const data = await deezer(this.url).catch(console.error);

      if (!data || data instanceof DeezerTrack) {
        throw new NoDataError();
      }

      const promiseTracksData: Promise<TrackData>[] = data.tracks.map(
        (track) => {
          const search = track.artist.name + " " + track.title;
          return DataFinder.searchTrackData(search);
        },
      );

      const tracks = await Promise.all(promiseTracksData);
      const duration = tracks.reduce(
        (total, track) => total + track.duration,
        0,
      );

      return { title: data.title, url: data.url, tracks, duration };
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
