import { expect, mock, test } from "bun:test";
import { PassThrough } from "node:stream";
import { StreamType } from "@discordjs/voice";
import { SoundCloudSourceAdapter } from "@core/sources/SoundCloudSourceAdapter";
import { YouTubeStreamConverter } from "@core/helpers/YouTubeStreamConverter";
import type { Track } from "@core/Track";

test("SoundCloud conserve un flux WebM/Opus compatible", async () => {
  const original = YouTubeStreamConverter.prototype.getDirectOpusStream;
  const direct = mock(async () => new PassThrough());
  YouTubeStreamConverter.prototype.getDirectOpusStream = direct;
  try {
    const track = {
      url: "https://soundcloud.com/artist/track",
      audioFormat: "webm-opus",
    } as Track;
    const source = await new SoundCloudSourceAdapter().open(track);
    expect(source.inputType).toBe(StreamType.WebmOpus);
    expect(direct).toHaveBeenCalledWith(track.url, "webm");
    source.close();
  } finally {
    YouTubeStreamConverter.prototype.getDirectOpusStream = original;
  }
});
