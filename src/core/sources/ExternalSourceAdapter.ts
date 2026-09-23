import { StreamType } from "@discordjs/voice";
import got from "got";
import type { Track } from "../Track";
import { audioJobScheduler } from "../helpers/AudioJobScheduler";
import {
  sourceStream,
  type SourceAdapter,
  type SourceStream,
} from "./SourceAdapter";

export class ExternalSourceAdapter implements SourceAdapter {
  public canHandle(): boolean {
    return true;
  }

  public async open(
    track: Track,
    _seek?: number,
    signal?: AbortSignal,
  ): Promise<SourceStream> {
    const release = await audioJobScheduler.acquire(1, signal);
    try {
      const stream = got.stream(track.url, {
        timeout: { lookup: 5_000, connect: 5_000, response: 15_000 },
        retry: { limit: 2 },
        signal,
      });
      stream.once("close", release);
      if (stream.destroyed) release();
      return sourceStream(stream, StreamType.Arbitrary);
    } catch (error) {
      release();
      throw error;
    }
  }
}
