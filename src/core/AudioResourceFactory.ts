import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import axios from "axios";
import { stream as getStream, so_validate, yt_validate } from "play-dl";
import type { Track } from "./Track";
import { getYouTubeStream } from "./helpers/YouTubeStreamConverter";

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
    const stream = await getYouTubeStream(track.url, { seek });

    if (!stream) {
      throw new Error("Unable to retrieve YouTube stream.");
    }
    return createAudioResource(stream, {
      metadata: track,
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
  }

  private async getExternalResource(
    track: Track,
  ): Promise<AudioResource<Track>> {
    try {
      const response = await axios.get(track.url, {
        responseType: "stream",
      });

      if (!response.data) {
        throw new Error("Unable to retrieve the stream.");
      }

      return createAudioResource(response.data, {
        metadata: track,
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });
    } catch (error: any) {
      throw new Error(`Error retrieving stream: ${error}`);
    }
  }
}

const audioResourceFactory = new AudioResourceFactory();
export { audioResourceFactory };
