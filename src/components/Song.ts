import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import axios from 'axios';
import { EmbedBuilder, User } from "discord.js";
import fetch from 'isomorphic-unfetch';
import { parseStream } from 'music-metadata';
import {
  DeezerTrack,
  SoundCloudTrack,
  deezer,
  stream as getStream,
  so_validate,
  soundcloud,
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
import { bot } from "../index";
import { formatTime } from "../utils/formatTime";
import { UrlType } from "../utils/validate";
const { getPreview } = require('spotify-url-info')(fetch);

interface SongData {
  url: string;
  title: string | undefined;
  duration: number;
  thumbnail: string | null;
}

export class Song {

  public readonly url: string;
  public readonly title: string | undefined;
  public readonly duration: number;
  public readonly thumbnail: string;
  public readonly requester: User;


  public constructor(options: SongData, requester: User) {
    Object.assign(this, options);
    this.requester = requester;
  }


  public static async from(search: string, requester: User ,type: UrlType): Promise<Song> {
    const url = search.split(" ").at(0);
    let songData : SongData;
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
      default : {
        if (type === false && url?.startsWith("http")) throw new InvalidURLError();
        songData = await Song.fromYoutube(url, search);
        break;
      }
    }
    return new Song(songData, requester);
  }

  public formatedTime() : string {
    if (this.duration == 0) {
      return i18n.__mf("nowplayingMsg.live");
    }
    return formatTime(this.duration);
  }

  public playingEmbed() : EmbedBuilder {
    return new EmbedBuilder({
      title: i18n.__mf("nowplayingMsg.startedPlaying"),
      description: `[${this.title}](${this.url})
      ${i18n.__mf("nowplayingMsg.duration", {duration: this.formatedTime()})}`,
      thumbnail: {
        url: this.thumbnail
      },
      color: 0x69adc7,
      footer: {
        text : i18n.__mf("nowplayingMsg.requestedBy", { name: this.requester.displayName }),
        icon_url: this.requester.avatarURL() ?? undefined
      }
    });
  }

  public async makeResource(seek? : number): Promise<AudioResource<Song>> {
    let stream;
    let type;

    if (seek) {
      if (yt_validate(this.url) ==! "video")
        throw new Error("Seeking is only supported for YouTube sources.");

      const response = await getStream(this.url, {
        htmldata: false,
        precache: 30,
        seek: seek
      });

      stream = response.stream;
      type = response.type;

    } else if (this.url.startsWith("https") && (yt_validate(this.url) === "video" || await so_validate(this.url) === "track")) {
      
      const response = await getStream(this.url, {
        htmldata: false,
        precache: 30,
        quality : config.AUDIO_QUALITY
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

    if (!stream) throw new Error("Unable to retrieve the audio stream.");

    return createAudioResource(stream, {
      metadata: this,
      inputType: type,
      inlineVolume: true,
    });
  }
  

  private static async fromYoutube(url: string = "", search: string = ""): Promise<SongData> {
    let songInfo;
    if (url.match(/^https?:\/\/\S+$/) && yt_validate(url) === "video") {
      songInfo = await youtube.getVideo(url).catch(console.error);

      if (!songInfo) throw new InvalidURLError();
      if (songInfo.nsfw) throw new AgeRestrictedError();

      return {
        url: songInfo.url,
        title: songInfo.title,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail?.url!,
      };
    } else {
      songInfo = await youtube.searchOne(search, "video", true).catch(console.error);
      if (!songInfo)
        throw new NothingFoundError();

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
      let songInfo = (await soundcloud(url) as SoundCloudTrack);

      return {
        url: songInfo.url,
        title: songInfo.name,
        duration: songInfo.durationInMs,
        thumbnail: songInfo.thumbnail,
      };
    
    } catch (error : any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError()
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  private static async fromSpotify(url: string = ""): Promise<SongData> {

    let data;
    try {
      data = await getPreview(url, {headers: {'user-agent': bot.useragent}});
    } catch (error : any) {
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
};