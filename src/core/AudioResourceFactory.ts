import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import got from "got";
import { stream as getStream, so_validate, yt_validate } from "play-dl";
import type { Track } from "./Track";
import {
  getYouTubeStream,
  YouTubeStreamConverter,
} from "./helpers/YouTubeStreamConverter";
import { audioCacheManager } from "./managers/AudioCacheManager";

export class AudioResourceFactory {
  public async createResource(
    track: Track,
    seek?: number,
  ): Promise<AudioResource<Track>> {
    if (await so_validate(track.url)) {
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
    const response = await getStream(track.url, {
      htmldata: false,
      precache: 15,
      quality: 0,
    });

    if (!response?.stream) {
      throw new Error("Unable to retrieve SoundCloud stream.");
    }

    return createAudioResource(response.stream, {
      metadata: track,
      inputType: response.type,
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
      : !seek && track.duration !== 0
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
}

const audioResourceFactory = new AudioResourceFactory();
export { audioResourceFactory };
