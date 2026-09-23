import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  ExtractionError,
  InvalidURLError,
  NoDataError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import fetch from "isomorphic-unfetch";
import { sp_validate } from "play-dl";
import { createRequire } from "node:module";
import type { SpotifyUrlInfoModule } from "spotify-url-info";
import { LinkExtractor } from "./abstract/LinkExtractor";
import { DataFinder } from "@core/helpers/DataFinder";

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
      return DataFinder.searchTrackData(search);
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      if (error instanceof Error && error.message.includes("parse")) {
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

      const limitedTracks = playlistTracks.slice(
        0,
        Math.min(config.MAX_PLAYLIST_SIZE, 50),
      );
      const tracks: TrackData[] = limitedTracks.flatMap((track) => {
        const id = /^spotify:track:([a-zA-Z0-9]+)$/.exec(track.uri)?.[1];
        return id && track.name && track.artist
          ? [
              {
                url: `https://open.spotify.com/track/${id}`,
                title: `${track.artist} ${track.name}`,
                duration: track.duration ?? -1,
                thumbnail: playlist.image ?? null,
              },
            ]
          : [];
      });
      if (!tracks.length) throw new NoDataError();
      const duration = tracks.reduce(
        (total, track) => total + Math.max(0, track.duration),
        0,
      );

      return {
        title: playlist.title,
        url: playlist.link,
        tracks: tracks,
        duration,
      };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      if (error instanceof Error && error.message.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }
}
