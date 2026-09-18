import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  ExtractionError,
  InvalidURLError,
  NoDataError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import { mapWithConcurrency } from "@utils/mapWithConcurrency";
import fetch from "isomorphic-unfetch";
import { sp_validate } from "play-dl";
import { createRequire } from "node:module";
import type { SpotifyUrlInfoModule } from "spotify-url-info";
import { LinkExtractor } from "./abstract/LinkExtractor";

const require = createRequire(import.meta.url);
const spotifyUrlInfo = require("spotify-url-info") as SpotifyUrlInfoModule;
const { getPreview, getTracks } = spotifyUrlInfo(fetch);

export class SpotifyLinkExtractor extends LinkExtractor {
  private static readonly SP_LINK =
    /^https?:\/\/(?:open|play)\.spotify\.com\/?.+/;
  private static readonly SP_ARTIST =
    /^https?:\/\/(?:open|play)\.spotify\.com\/artist\/?.+/;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (RegExp(SpotifyLinkExtractor.SP_LINK).exec(url)) {
      const result = sp_validate(url);
      if (result == "search") return false;
      if (result == "album") return "playlist";
      if (RegExp(SpotifyLinkExtractor.SP_ARTIST).exec(url)) return "playlist";
      return result;
    }
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const data = await getPreview(this.url, {
        headers: { "user-agent": config.USERAGENT },
      });
      if (!data.type) throw new NoDataError();

      const search = data.artist + " " + data.track;
      const { DataFinder } = await import("@core/helpers/DataFinder");
      return DataFinder.searchTrackData(search);
    } catch (error: any) {
      if (error instanceof ExtractionError) throw error;
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      const playlist = await getPreview(this.url, {
        headers: { "user-agent": config.USERAGENT },
      });
      if (!playlist) {
        throw new NoDataError();
      }
      const playlistTracks = await getTracks(this.url, {
        headers: { "user-agent": config.USERAGENT },
      });

      const { DataFinder } = await import("@core/helpers/DataFinder");
      const limitedTracks = playlistTracks.slice(0, config.MAX_PLAYLIST_SIZE);
      const results = await mapWithConcurrency(
        limitedTracks,
        4,
        (track: any) => {
          const search = track.artist + " " + track.name;
          return DataFinder.searchTrackData(search);
        },
      );
      const tracks = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (!tracks.length) throw new NoDataError();
      const duration = tracks.reduce(
        (total, track) => total + track.duration,
        0,
      );

      return {
        title: playlist.title,
        url: playlist.link,
        tracks: tracks,
        duration,
      };
    } catch (error: any) {
      if (error instanceof ExtractionError) throw error;
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }
}
