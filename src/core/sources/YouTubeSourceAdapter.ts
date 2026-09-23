import { StreamType } from "@discordjs/voice";
import { yt_validate } from "play-dl";
import type { Track } from "../Track";
import {
  getYouTubeStream,
  YouTubeStreamConverter,
} from "../helpers/YouTubeStreamConverter";
import { audioCacheManager } from "../managers/AudioCacheManager";
import { classifyAudioFailure } from "../helpers/AudioFailure";
import {
  sourceStream,
  type SourceAdapter,
  type SourceStream,
} from "./SourceAdapter";

export class YouTubeSourceAdapter implements SourceAdapter {
  public canHandle(track: Track): boolean {
    return yt_validate(track.url) === "video";
  }

  public async open(
    track: Track,
    seek?: number,
    signal?: AbortSignal,
    url = track.url,
  ): Promise<SourceStream> {
    const cached = await audioCacheManager.get(url);
    if (cached) {
      const stream = seek
        ? await new YouTubeStreamConverter({ signal }).transcodeFile(
            cached,
            seek,
          )
        : await audioCacheManager.open(url);
      if (!stream) throw new Error("Cached audio disappeared");
      return sourceStream(stream, StreamType.OggOpus, track.duration > 0);
    }
    if (!seek && track.duration !== 0) {
      try {
        const stream = await new YouTubeStreamConverter({
          signal,
        }).getDirectOpusStream(url);
        return sourceStream(stream, StreamType.WebmOpus, true);
      } catch (error) {
        if (signal?.aborted) throw error;
        if (["auth", "unavailable"].includes(classifyAudioFailure(error).kind))
          throw error;
        const stream = await getYouTubeStream(url, { signal });
        return sourceStream(stream, StreamType.OggOpus, true);
      }
    }
    const stream = await getYouTubeStream(url, {
      seek,
      isLive: track.duration === 0,
      signal,
    });
    return sourceStream(stream, StreamType.OggOpus, track.duration > 0);
  }

  public preload(track: Track, signal?: AbortSignal): Promise<string | null> {
    if (track.duration === 0) return Promise.resolve(null);
    return audioCacheManager.preload(
      track.url,
      () => getYouTubeStream(track.url, { signal, priority: 0 }),
      signal,
    );
  }
}
