import { expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { StreamType } from "@discordjs/voice";
import { YouTubeSourceAdapter } from "@core/sources/YouTubeSourceAdapter";
import { YouTubeStreamConverter } from "@core/helpers/YouTubeStreamConverter";
import { audioCacheManager } from "@core/managers/AudioCacheManager";
import type { Track } from "@core/Track";

test("une source YouTube WebM/Opus compatible contourne le transcodage", async () => {
  const originalGet = audioCacheManager.get;
  const originalDirect = YouTubeStreamConverter.prototype.getDirectOpusStream;
  const direct = mock(async () => new PassThrough());
  audioCacheManager.get = async () => null;
  YouTubeStreamConverter.prototype.getDirectOpusStream = direct;
  try {
    const adapter = new YouTubeSourceAdapter();
    const track = {
      url: "https://youtube.com/watch?v=abc123",
      duration: 60_000,
    } as Track;
    const source = await adapter.open(track);
    expect(source.inputType).toBe(StreamType.WebmOpus);
    expect(source.format).toEqual({
      container: "webm",
      codec: "opus",
      seekable: true,
    });
    expect(direct).toHaveBeenCalledTimes(1);
    source.close();
  } finally {
    audioCacheManager.get = originalGet;
    YouTubeStreamConverter.prototype.getDirectOpusStream = originalDirect;
  }
});
