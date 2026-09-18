import {
  getSoundCloudInfo,
  type SoundCloudInfo,
} from "@core/helpers/SoundCloudYtDlp";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import {
  InvalidURLError,
  NoDataError,
  ServiceUnavailableError,
} from "@errors/ExtractionErrors";
import { config } from "config";
import { LinkExtractor } from "./abstract/LinkExtractor";

export class SoundCloudLinkExtractor extends LinkExtractor {
  private static readonly validationData = new Map<
    string,
    Promise<SoundCloudInfo>
  >();
  private static readonly SO_LINK =
    /^https?:\/\/(?:(?:www|m|on|api)\.)?(?:soundcloud\.com|snd\.sc)\/.+$/i;

  public static override async validate(
    url: string,
  ): Promise<"track" | "playlist" | false> {
    if (!this.SO_LINK.test(url)) return false;
    const pending = getSoundCloudInfo(url, 1);
    this.validationData.set(url, pending);
    try {
      const data = await pending;
      return data.entries ? "playlist" : "track";
    } catch (error) {
      this.validationData.delete(url);
      throw error;
    }
  }

  protected async extractTrack(): Promise<TrackData> {
    try {
      const track = SoundCloudLinkExtractor.toTrackData(
        await this.takeValidationData(),
      );
      if (!track) throw new NoDataError();
      return track;
    } catch (error) {
      this.rethrowExtractionError(error);
    }
  }

  private takeValidationData(): Promise<SoundCloudInfo> {
    const pending = SoundCloudLinkExtractor.validationData.get(this.url);
    SoundCloudLinkExtractor.validationData.delete(this.url);
    return pending ?? getSoundCloudInfo(this.url, 1);
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    try {
      SoundCloudLinkExtractor.validationData.delete(this.url);
      const data = await getSoundCloudInfo(this.url);
      const tracks = (data.entries ?? [])
        .slice(0, config.MAX_PLAYLIST_SIZE)
        .map(SoundCloudLinkExtractor.toTrackData)
        .filter((track): track is TrackData => track !== null);
      if (!tracks.length) throw new NoDataError();
      return {
        title: data.title ?? "SoundCloud playlist",
        url: data.webpage_url ?? data.original_url ?? this.url,
        tracks,
        duration: tracks.reduce((total, track) => total + track.duration, 0),
      };
    } catch (error) {
      this.rethrowExtractionError(error);
    }
  }

  private static toTrackData(data: SoundCloudInfo | null): TrackData | null {
    const url = data?.webpage_url ?? data?.original_url;
    if (!data?.title || !url) return null;
    return {
      url,
      title: data.title,
      duration: Math.round((data.duration ?? 0) * 1000),
      thumbnail: data.thumbnail ?? null,
    };
  }

  private rethrowExtractionError(error: unknown): never {
    if (error instanceof NoDataError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (
      /unsupported url|not available|not found|private|http error 404/i.test(
        message,
      )
    )
      throw new InvalidURLError();
    if (/http error 429|http error 50[0234]|timed? out|network/i.test(message))
      throw new ServiceUnavailableError();
    throw error;
  }
}
