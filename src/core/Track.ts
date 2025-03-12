import type { TrackData } from "@custom-types/extractor/TrackData";
import { formatTime } from "@utils/formatTime";
import { User } from "discord.js";
import { i18n } from "i18n.config";
import { video_basic_info, yt_validate } from "play-dl";
import { DataFinder } from "./helpers/DataFinder";

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
      ? i18n.__("nowplayingMsg.live")
      : formatTime(this.duration);
  }

  public async getRelated(): Promise<string[]> {
    if (this.related) return this.related;
    let url = this.url;
    if (yt_validate(url) !== "video") {
      const trackInfo = await DataFinder.searchTrackData(this.title);
      if (!trackInfo) return [];
      url = trackInfo.url;
    }
    const info = await video_basic_info(url, { htmldata: false });
    this.related = info.related_videos;
    return info.related_videos;
  }

  public get data(): TrackData {
    return {
      url: this.url,
      title: this.title,
      duration: this.duration,
      thumbnail: this.thumbnail,
      related: this.related,
    };
  }
}
