import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";
import got from "got";
import { LinkExtractor } from "./abstract/LinkExtractor";

export class ExternalLinkExtractor extends LinkExtractor {
  private static readonly AUDIO_LINK =
    /^https?:\/\/.+\.(?:mp3|wav|flac|ogg)(?:\?.*)?$/i;

  public static override async validate(url: string): Promise<"track" | false> {
    if (this.AUDIO_LINK.test(url)) return "track";
    if (!/^https?:\/\//i.test(url)) return false;
    try {
      const response = await got.head(url, {
        timeout: { request: 3_000 },
        retry: { limit: 0 },
      });
      return /^audio\//i.test(response.headers["content-type"] ?? "")
        ? "track"
        : false;
    } catch {
      return false;
    }
  }

  protected async extractTrack(): Promise<TrackData> {
    const parsed = new URL(this.url);
    let title = decodeURIComponent(
      parsed.pathname.split("/").at(-1) || "audio",
    );
    // A HEAD request obtains a filename without downloading the audio body.
    // Duration is unknown when the server does not supply it.
    let duration = -1;
    try {
      const response = await got.head(this.url, {
        timeout: { request: 5_000 },
        retry: { limit: 1 },
      });
      const disposition = response.headers["content-disposition"];
      const filename = /filename\*?=(?:UTF-8''|["'])?([^;"']+)/i.exec(
        disposition ?? "",
      );
      if (filename?.[1]) title = decodeURIComponent(filename[1]);
      const seconds = Number(response.headers["x-content-duration"]);
      if (Number.isFinite(seconds) && seconds > 0) duration = seconds * 1000;
    } catch {
      // Some audio hosts do not implement HEAD. Playback still uses GET.
    }
    return { url: this.url, title, duration, thumbnail: null };
  }

  protected async extractPlaylist(): Promise<PlaylistData> {
    throw new Error("External links do not support playlists");
  }
}
