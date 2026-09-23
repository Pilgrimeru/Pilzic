import { StreamType } from "@discordjs/voice";
import type { Track } from "../Track";
import {
  getSoundCloudStream,
  YouTubeStreamConverter,
} from "../helpers/YouTubeStreamConverter";
import { classifyAudioFailure } from "../helpers/AudioFailure";
import {
  sourceStream,
  type SourceAdapter,
  type SourceStream,
} from "./SourceAdapter";

export class SoundCloudSourceAdapter implements SourceAdapter {
  public canHandle(track: Track): boolean {
    try {
      return /^(?:(?:www|m|on|api)\.)?soundcloud\.com$|^(?:www\.)?snd\.sc$/.test(
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
    if (!seek && track.audioFormat) {
      try {
        const container = track.audioFormat === "webm-opus" ? "webm" : "ogg";
        const stream = await new YouTubeStreamConverter({
          source: "soundcloud",
          signal,
        }).getDirectOpusStream(track.url, container);
        return sourceStream(
          stream,
          container === "webm" ? StreamType.WebmOpus : StreamType.OggOpus,
          track.duration > 0,
        );
      } catch (error) {
        if (signal?.aborted) throw error;
        if (["auth", "unavailable"].includes(classifyAudioFailure(error).kind))
          throw error;
      }
    }
    const stream = await getSoundCloudStream(track.url, { signal, seek });
    return sourceStream(stream, StreamType.OggOpus, track.duration > 0);
  }
}
