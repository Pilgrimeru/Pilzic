import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  ExtractionError,
  InvalidURLError,
  NoDataError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import { deezer, DeezerTrack, dz_validate } from "play-dl";
import { LinkExtractor } from "./abstract/LinkExtractor";
import { DataFinder } from "@core/helpers/DataFinder";

export class DeezerLinkExtractor extends LinkExtractor {
  private static readonly DZ_LINK =
    /^https?:\/\/(?:www\.)?(?:deezer\.com|deezer\.page\.link)\/?.+/;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (RegExp(DeezerLinkExtractor.DZ_LINK).exec(url)) {
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname !== "deezer.page.link") {
        return DeezerLinkExtractor.classifyPath(parsedUrl.pathname);
      }
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(5_000),
      }).catch(() => null);
      if (!response?.ok) return false;
      return DeezerLinkExtractor.classifyPath(new URL(response.url).pathname);
    }
    const validate = await dz_validate(url);
    if (validate === "album") return "playlist";
    if (validate === "search") return false;
    return validate;
  }

  private static classifyPath(path: string): "track" | "playlist" | false {
    if (/^\/(?:[a-z]{2}\/)?track\//i.test(path)) return "track";
    if (/^\/(?:[a-z]{2}\/)?(?:album|playlist)\//i.test(path)) return "playlist";
    return false;
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const data = await deezer(this.url);
      if (!data || !(data instanceof DeezerTrack)) {
        throw new NoDataError();
      }

      const search = data.artist.name + " " + data.title;
      return DataFinder.searchTrackData(search);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (message.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      const data = await deezer(this.url);

      if (!data || data instanceof DeezerTrack) {
        throw new NoDataError();
      }

      const sourceTracks = data.tracks.slice(
        0,
        Math.min(config.MAX_PLAYLIST_SIZE, 50),
      );
      const tracks: TrackData[] = sourceTracks.flatMap((track) =>
        track.url && track.title
          ? [
              {
                url: track.url,
                title: `${track.artist.name} ${track.title}`,
                duration: track.durationInSec * 1000,
                thumbnail: null,
              },
            ]
          : [],
      );
      if (!tracks.length) throw new NoDataError();
      const duration = tracks.reduce(
        (total, track) => total + track.duration,
        0,
      );

      return { title: data.title, url: data.url, tracks, duration };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (message.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }
}
