import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import axios from 'axios';
import { EmbedBuilder, User } from "discord.js";
import {
  stream as getStream,
  so_validate,
  video_basic_info,
  yt_validate
} from "play-dl";
import ytstream from 'yt-stream';
import { config } from "../config.js";
import { i18n } from "../i18n.config.js";
import type { TrackData } from "../types/extractor/TrackData.js";
import { formatTime } from "../utils/formatTime.js";
import { DataFinder } from "./helpers/DataFinder.js";

export class Track {
  public readonly url!: string;
  public readonly title!: string;
  public readonly duration!: number;
  public readonly thumbnail!: string;
  public readonly requester: User;
  private related: string[] | undefined;

  private constructor(options: TrackData, requester: User) {
    Object.assign(this, options);
    this.requester = requester;
  }

  public static from(trackData: TrackData, requester: User): Track {
    return new Track(trackData, requester);
  }

  public formatedTime(): string {
    return this.duration === 0
      ? i18n.__mf("nowplayingMsg.live")
      : formatTime(this.duration);
  }

  public playingEmbed(): EmbedBuilder {
    return new EmbedBuilder({
      title: i18n.__mf("nowplayingMsg.startedPlaying"),
      description: `[${this.title}](${this.url})
      ${i18n.__mf("nowplayingMsg.duration", { duration: this.formatedTime() })}`,
      thumbnail: {
        url: this.thumbnail
      },
      color: config.COLORS.MAIN,
      footer: {
        text: i18n.__mf("nowplayingMsg.requestedBy", { name: this.requester?.displayName ?? "unknown" }),
        icon_url: this.requester?.avatarURL() ?? undefined
      }
    });
  }

  public async getRelated(): Promise<string[]> {
    if (this.related) return this.related;
    let url = this.url;
    if (yt_validate(url) !== "video") {
      const songInfo = await DataFinder.searchTrackData(this.title);
      if (!songInfo) return [];
      url = songInfo.url;
    }
    const info = await video_basic_info(url, { htmldata: false });
    this.related = info.related_videos;
    return info.related_videos;
  }

  public async makeResource(seek?: number): Promise<AudioResource<Track>> {
    let stream;
    let type: StreamType;

    if (seek) {
      if (yt_validate(this.url) !== "video") {
        throw new Error("The seek feature is not available with this fix, I'm working on it.");
      }

      throw new Error("The seek feature is not available with this fix, I'm working on it.");

    } else if (this.url.startsWith("https") && await so_validate(this.url) === "track") {
      const response = await getStream(this.url, {
        htmldata: false,
        precache: 15,
        quality: config.AUDIO_QUALITY
      });
      stream = response.stream;
      type = response.type;
    } else if (this.url.startsWith("https") && yt_validate(this.url) === "video") {
      const reponse = await ytstream.stream(this.url, {
        quality: 'high',
        type: 'audio',
        highWaterMark: 1048576 * 32,
        download: true
      });
      stream = reponse.stream;
      type = reponse.type as any;
    }
    else {
      const response = await axios.get(this.url, {
        responseType: 'stream',
      });
      stream = response.data;
      type = StreamType.Arbitrary;
    }

    if (!stream) {
      throw new Error("Unable to retrieve the audio stream.");
    }

    return createAudioResource(stream, {
      metadata: this,
      inputType: type,
      inlineVolume: true,
    });
  }


  public get data(): TrackData {
    return {
      url: this.url,
      title: this.title,
      duration: this.duration,
      thumbnail: this.thumbnail,
      related: this.related
    };
  }
}