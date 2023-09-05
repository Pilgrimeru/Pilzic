import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import axios from 'axios';
import { EmbedBuilder } from "discord.js";
import fetch from 'isomorphic-unfetch';
import { parseStream } from 'music-metadata';
import {
  DeezerTrack,
  SoundCloudTrack,
  deezer,
  soundcloud,
  so_validate,
  yt_validate,
  stream as getStream
} from "play-dl";
import youtube from "youtube-sr";
import { config } from "../config";
import {
  InvalidURLException,
  NoDataException,
  NothingFoundException,
  ServiceUnavailableException
} from '../exceptions/ExtractionExceptions';
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { formatTime } from "../utils/formatTime";
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


  public constructor(options: SongData) {
    Object.assign(this, options);
  }


  public static async from(url: string, search: string, type: string | false): Promise<Song> {
    switch (type) {
      case "sp_track":
        return await Song.fromSpotify(url);
      case "so_track":
        return await Song.fromSoundCloud(url);
      case "dz_track":
        return await Song.fromDeezer(url);
      case "audio":
        return await Song.fromExternalLink(url);
      default : {
        if (type === false && url.startsWith("http")) throw new InvalidURLException();
        return await Song.fromYoutube(url, search);
      }
    }
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
      ${i18n.__mf("nowplayingMsg.duration", " ")}\`${this.formatedTime()}\``,
      thumbnail: {
        url: this.thumbnail
      },
      color: 0x69adc7
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
  

  private static async fromYoutube(url: string = "", search: string = ""): Promise<Song> {
    let songInfo;
    if (url.startsWith("https") && yt_validate(url) === "video") {
      songInfo = await youtube.getVideo(url).catch(console.error);
      if (!songInfo)
        throw new InvalidURLException();

      return new this({
        url: songInfo.url,
        title: songInfo.title,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail?.url!,
      });
    } else {
      songInfo = await youtube.searchOne(search).catch(console.error);
      if (!songInfo)
        throw new NothingFoundException();

      return new this({
        url: songInfo.url,
        title: songInfo.title,
        duration: songInfo.duration,
        thumbnail: songInfo.thumbnail?.url!,
      });
    }
  }

  private static async fromSoundCloud(url: string = ""): Promise<Song> {
    try {
      let songInfo = (await soundcloud(url) as SoundCloudTrack);

      return new this({
        url: songInfo.url,
        title: songInfo.name,
        duration: songInfo.durationInMs,
        thumbnail: songInfo.thumbnail,
      });
    
    } catch (error : any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLException()
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableException();
      }
      throw error;
    }
  }

  private static async fromSpotify(url: string = ""): Promise<Song> {

    let data;
    try {
      data = await getPreview(url, {headers: {'user-agent': bot.useragent}});
    } catch (error : any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLException();
      } else {
        throw new ServiceUnavailableException();
      }
    }
    if (!data.type) throw new NoDataException();
    const search = data.artist + " " + data.track;
    return await Song.fromYoutube("", search);
  }

  private static async fromDeezer(url: string = ""): Promise<Song> {
    let data;
    try {
      data = await deezer(url);
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLException();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableException();
      }
      throw error;
    }
    
    let track: DeezerTrack | undefined;
    if (data && data.type === "track") {
      track = data as DeezerTrack;
    } else {
      throw new NoDataException();
    }
    let search = track.artist.name + " " + track.title;
    return await Song.fromYoutube("", search);
  }

  private static async fromExternalLink(url: string = ""): Promise<Song> {
    if (url.startsWith("http") && /\.(mp3|wav|flac|ogg)$/i.test(url)) {

      const name = url.substring(url.lastIndexOf("/") + 1);

      const response = await axios.get(url, {
        responseType: 'stream',
      }).catch(() => null);
      if (!response) throw new InvalidURLException();

      let duration = (await parseStream(response.data, {
        mimeType: response.headers["content-type"],
        size: response.headers["content-length"]
      })).format.duration;

      duration = duration ? Math.floor(duration) * 1000 : 1;

      return new this({
        url: url,
        title: name,
        duration: duration,
        thumbnail: null,
      });
    }
    throw new NoDataException();
  }
};