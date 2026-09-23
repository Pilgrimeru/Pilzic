import { expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { StreamType } from "@discordjs/voice";
import { AudioResourceFactory } from "@core/AudioResourceFactory";
import type { SourceAdapter } from "@core/sources/SourceAdapter";
import type { Track } from "@core/Track";

test("ferme une source créée après l'annulation de sa transition", async () => {
  const controller = new AbortController();
  const close = mock(() => undefined);
  const adapter: SourceAdapter = {
    canHandle: () => true,
    open: async () => {
      controller.abort(new Error("superseded"));
      return {
        stream: new PassThrough(),
        inputType: StreamType.OggOpus,
        format: { container: "ogg", codec: "opus", seekable: false },
        close,
      };
    },
  };
  const factory = new AudioResourceFactory([adapter]);
  await expect(
    factory.createResource(
      { url: "https://example.test/audio" } as Track,
      undefined,
      controller.signal,
    ),
  ).rejects.toThrow("superseded");
  expect(close).toHaveBeenCalledTimes(1);
});
