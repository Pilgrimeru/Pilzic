import { StreamType } from "@discordjs/voice";
import type { Readable } from "node:stream";
import type { Track } from "../Track";

export interface SourceStream {
  stream: Readable;
  inputType: StreamType;
  format: {
    container: "webm" | "ogg" | "unknown";
    codec: "opus" | "unknown";
    seekable: boolean;
  };
  close(): void;
}

export interface SourceAdapter {
  canHandle(track: Track): boolean;
  open(
    track: Track,
    seek?: number,
    signal?: AbortSignal,
  ): Promise<SourceStream>;
  preload?(track: Track, signal?: AbortSignal): Promise<string | null>;
}

export function sourceStream(
  stream: Readable,
  inputType: StreamType,
  seekable = false,
): SourceStream {
  const format =
    inputType === StreamType.WebmOpus
      ? { container: "webm" as const, codec: "opus" as const, seekable }
      : inputType === StreamType.OggOpus
        ? { container: "ogg" as const, codec: "opus" as const, seekable }
        : {
            container: "unknown" as const,
            codec: "unknown" as const,
            seekable,
          };
  return { stream, inputType, format, close: () => stream.destroy() };
}
