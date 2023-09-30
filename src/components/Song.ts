import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import axios from 'axios';
import { EmbedBuilder, User } from "discord.js";
import fetch from 'isomorphic-unfetch';
import { LRUCache } from 'lru-cache';
import { parseStream } from 'music-metadata';
import {
  DeezerTrack,
  SoundCloudTrack,
  deezer,
  stream as getStream,
  so_validate,
  soundcloud,
  video_basic_info,
  yt_validate
} from "play-dl";
import youtube from "youtube-sr";
import { config } from "../config";
import {
  AgeRestrictedError,
  InvalidURLError,
  NoDataError,
  NothingFoundError,
  ServiceUnavailableError
} from '../errors/ExtractionErrors';
import { i18n } from "../i18n.config";
import { formatTime } from "../utils/formatTime";
import { UrlType } from "../utils/validate";
import { Bot } from "./Bot";
const { getPreview } = require('spotify-url-info')(fetch);

export interface SongData {
  url: string;
  title: string;
  duration: number;
  thumbnail: string | null;
  related?: string[];
}

export class Song {
  private static readonly songsDataCache = new LRUCache<string, SongData>({ max: 1500 });

  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public readonly thumbnail: string;
  public readonly requester: User;
  private related: string[] | undefined;

  public constructor(options: SongData, requester: User) {
    Object.assign(this, options);
    this.requester = requester;
  }


  public static async from(search: string, requester: User, type: UrlType): Promise<Song> {
    const cachedSongData = Song.songsDataCache.get(search);
    if (cachedSongData) return new Song(cachedSongData, requester);

    const url = search.split(" ")[0];

    let songData: SongData;
    switch (type) {
      case "sp_track":
        songData = await Song.fromSpotify(url);
        break;
      case "so_track":
        songData = await Song.fromSoundCloud(url);
        break;
      case "dz_track":
        songData = await Song.fromDeezer(url);
        break;
      case "audio":
        songData = await Song.fromExternalLink(url);
        break;
      default: {
        if (!type && url?.match(/^https?:\/\/\S+$/)) throw new InvalidURLError();
        songData = await Song.fromYoutube(url, search);
        break;
      }
    }
    Song.songsDataCache.set(search, songData);
    return new Song(songData, requester);
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
      color: 0x69adc7,
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
      const songInfo = await youtube.searchOne(this.title, "video", true).catch(console.error);
      if (!songInfo) return [];
      url = songInfo.url;
    }
    const info = await video_basic_info(url, { htmldata: false });
    this.related = info.related_videos;
    return info.related_videos;
  }

  public async makeResource(seek?: number): Promise<AudioResource<Song>> {
    let stream;
    let type;

    if (seek) {
      if (yt_validate(this.url) !== "video") {
        throw new Error("Seeking is only supported for YouTube sources.");
      }

      const response = await getStream(this.url, {
        htmldata: false,
        precache: 10,
        seek
      });

      stream = response.stream;
      type = response.type;
    } else if (this.url.startsWith("https") && (yt_validate(this.url) === "video" || await so_validate(this.url) === "track")) {
      const response = await getStream(this.url, {
        htmldata: false,
        precache: 15,
        quality: config.AUDIO_QUALITY
      });
      stream = response.stream;
      type = response.type;
    } else {
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


  public get data(): SongData {
    return {
      url: this.url,
      title: this.title,
      duration: this.duration,
      thumbnail: this.thumbnail,
      related: this.related
    };
  }


  private static async fromYoutube(url: string = "", search: string = ""): Promise<SongData> {
    let songInfo;
    if (url.startsWith("https") && yt_validate(url) === "video") {
      try {
        songInfo = await video_basic_info(url);
      } catch (error: any) {
        if (error.message?.includes("confirm your age")) {
          throw new AgeRestrictedError();
        }
        if (error.message?.includes("you are a bot")) {
          throw new ServiceUnavailableError();
        }
        if (error.message?.includes("Private video") || error.message?.includes("Video unavailable")) {
          throw new InvalidURLError();
        }
        throw error;
      }
      if (!songInfo.video_details.title) {
        throw new NothingFoundError();
      }

      return {
        url: songInfo.video_details.url,
        title: songInfo.video_details.title,
        duration: songInfo.video_details.durationInSec * 1000,
        thumbnail: songInfo.video_details.thumbnails[0].url,
        related: songInfo.related_videos
      };
    } else {
      songInfo = await youtube.searchOne(search, "video", true).catch(console.error);
      if (!songInfo || !songInfo.title) {
        throw new NothingFoundError();
      }

      return {
        url: songInfo.url,
        title: songInfo.title,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail?.url!,
      };
    }
  }

  private static async fromSoundCloud(url: string = ""): Promise<SongData> {
    try {
      let songInfo = (await soundcloud(url)) as SoundCloudTrack;

      return {
        url: songInfo.url,
        title: songInfo.name,
        duration: songInfo.durationInMs,
        thumbnail: songInfo.thumbnail,
      };
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  private static async fromSpotify(url: string = ""): Promise<SongData> {
    let data;
    try {
      data = await getPreview(url, { headers: { 'user-agent': Bot.useragent } });
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
    if (!data.type) throw new NoDataError();
    const search = data.artist + " " + data.track;
    return await Song.fromYoutube("", search);
  }

  private static async fromDeezer(url: string = ""): Promise<SongData> {
    let data;
    try {
      data = await deezer(url);
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }

    let track: DeezerTrack | undefined;
    if (data && data.type === "track") {
      track = data as DeezerTrack;
    } else {
      throw new NoDataError();
    }
    let search = track.artist.name + " " + track.title;
    return await Song.fromYoutube("", search);
  }

  private static async fromExternalLink(url: string = ""): Promise<SongData> {
    if (url.startsWith("http") && /\.(mp3|wav|flac|ogg)$/i.test(url)) {
      const name = url.substring(url.lastIndexOf("/") + 1);

      const response = await axios.get(url, {
        responseType: 'stream',
      }).catch(() => null);
      if (!response) throw new InvalidURLError();

      let duration = (await parseStream(response.data, {
        mimeType: response.headers["content-type"],
        size: response.headers["content-length"]
      })).format.duration;

      duration = duration ? Math.floor(duration) * 1000 : 1;

      return {
        url: url,
        title: name,
        duration: duration,
        thumbnail: null,
      };
    }
    throw new NoDataError();
  }
}