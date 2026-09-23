import type { Track } from "../Track";
import { DataFinder } from "../helpers/DataFinder";
import type { SourceAdapter, SourceStream } from "./SourceAdapter";
import type { YouTubeSourceAdapter } from "./YouTubeSourceAdapter";

export class CatalogSourceAdapter implements SourceAdapter {
  private readonly resolvedUrls = new WeakMap<Track, string>();

  constructor(private readonly youtube: YouTubeSourceAdapter) {}

  public canHandle(track: Track): boolean {
    try {
      return /^(?:open|play)\.spotify\.com$|^(?:www\.)?deezer\.com$/.test(
        new URL(track.url).hostname.toLowerCase(),
      );
    } catch {
      return false;
    }
  }

  public async open(
    track: Track,
    seek?: number,
    signal?: AbortSignal,
  ): Promise<SourceStream> {
    let url = this.resolvedUrls.get(track);
    if (!url) {
      url = (await DataFinder.searchTrackData(track.title)).url;
      if (signal?.aborted) throw signal.reason;
      this.resolvedUrls.set(track, url);
    }
    return this.youtube.open(track, seek, signal, url);
  }
}
