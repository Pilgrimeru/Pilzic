import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import got from "got";
import { yt_validate } from "play-dl";
import type { Track } from "./Track";
import {
  getYouTubeStream,
  getSoundCloudStream,
  YouTubeStreamConverter,
} from "./helpers/YouTubeStreamConverter";
import { audioCacheManager } from "./managers/AudioCacheManager";

export class AudioResourceFactory {
  public async createResource(
    track: Track,
    seek?: number,
  ): Promise<AudioResource<Track>> {
    if (this.isSoundCloudUrl(track.url)) {
      return this.getSoundCloudResource(track);
    } else if (yt_validate(track.url) === "video") {
      return this.getYouTubeResource(track, seek);
    } else {
      return this.getExternalResource(track);
    }
  }

  private async getSoundCloudResource(
    track: Track,
  ): Promise<AudioResource<Track>> {
    const stream = await getSoundCloudStream(track.url);
    if (!stream) {
      throw new Error("Unable to retrieve SoundCloud stream.");
    }

    return createAudioResource(stream, {
      metadata: track,
      inputType: StreamType.OggOpus,
      inlineVolume: true,
    });
  }

  private async getYouTubeResource(
    track: Track,
    seek?: number,
  ): Promise<AudioResource<Track>> {
    const cached = audioCacheManager.get(track.url);
    const freshStream = cached
      ? null
      : await getYouTubeStream(track.url, {
          seek,
          isLive: track.duration === 0,
        });
    const stream = cached
      ? seek
        ? new YouTubeStreamConverter().transcodeFile(cached, seek)
        : audioCacheManager.open(track.url)
      : !seek && track.duration !== 0 && audioCacheManager.enabled
        ? audioCacheManager.tee(track.url, freshStream!)
        : freshStream;

    if (!stream) {
      throw new Error("Unable to retrieve YouTube stream.");
    }
    return createAudioResource(stream, {
      metadata: track,
      // YouTubeStreamConverter always emits an Ogg container containing Opus
      // at 48 kHz, including seeks and live streams. Declaring it explicitly
      // avoids an unnecessary second FFmpeg pass in prism-media.
      inputType: StreamType.OggOpus,
      inlineVolume: true,
    });
  }

  private async getExternalResource(
    track: Track,
  ): Promise<AudioResource<Track>> {
    try {
      const response = got.stream(track.url, {
        timeout: { lookup: 5_000, connect: 5_000, response: 15_000 },
        retry: { limit: 2 },
      });
      return createAudioResource(response, {
        metadata: track,
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });
    } catch (error: any) {
      throw new Error(`Error retrieving stream: ${error}`);
    }
  }

  public preload(track: Track): Promise<string | null> {
    if (track.duration === 0 || yt_validate(track.url) !== "video") {
      return Promise.resolve(null);
    }
    return audioCacheManager.preload(track.url, () =>
      getYouTubeStream(track.url),
    );
  }

  private isSoundCloudUrl(value: string): boolean {
    try {
      return /^(?:(?:www|m|on|api)\.)?soundcloud\.com$|^(?:www\.)?snd\.sc$/.test(
        new URL(value).hostname.toLowerCase(),
      );
    } catch {
      return false;
    }
  }
}

const audioResourceFactory = new AudioResourceFactory();
export { audioResourceFactory };
