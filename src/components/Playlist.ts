import fetch from 'isomorphic-unfetch';
import { DeezerAlbum, DeezerPlaylist, SoundCloudPlaylist, SoundCloudTrack, deezer, soundcloud } from "play-dl";
import youtube, { Video, Playlist as YoutubePlaylist } from "youtube-sr";
import { config } from "../config";
import {
  InvalidURLError,
  NoDataError,
  NothingFoundError,
  ServiceUnavailableError,
  YoutubeMixesError
} from '../errors/ExtractionErrors';
import { bot } from '../index';
import { Song } from "./Song";
const { getPreview, getTracks } = require('spotify-url-info')(fetch);

interface PlaylistData {
  title: string;
  url: string;
  songs: Song[];
}

export class Playlist {

  public readonly title: string;
  public readonly url: string;
  public readonly songs: Song[];


  public constructor(options: PlaylistData) {
    Object.assign(this, options);
  }


  public static async from(url: string = "", search: string = "", type: string | false): Promise<Playlist> {
    if (type === "sp_playlist" || type === "sp_album" || type === "sp_artist") {
      return await Playlist.fromSpotify(url);
    }
    if (type === "so_playlist") {
      return await Playlist.fromSoundcloud(url);
    }
    if (type === "dz_playlist" || type === "dz_album") {
      return await Playlist.fromDeezer(url);
    }
    
    if (url.startsWith("http") && type == false) throw new InvalidURLError();
    
    return await Playlist.fromYoutube(url, search);
  }


  private static async fromYoutube(url: string = "", search: string = ""): Promise<Playlist> {
    const YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;
    const urlValid = youtube.isPlaylist(url);
    if (url.match(YT_LINK) && !urlValid) throw new YoutubeMixesError();

    let playlist: YoutubePlaylist | void;
    try {
      if (urlValid) {
        playlist = await youtube.getPlaylist(url, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE 
        });
        if (!playlist) throw new InvalidURLError();
        
      } else {
        const result = await youtube.searchOne(search, "playlist");
        playlist = await youtube.getPlaylist(result.url!, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE
        });
        if (!playlist) throw new NothingFoundError();
      }
    } catch (error : any) {
        if (error.message?.includes("Mixes")) {
        throw new YoutubeMixesError();
      }
      throw error;
    }
    const songs = Playlist.getSongsFromYoutube(playlist.videos);

    return new this({ title: playlist.title ?? "unknown", url: playlist.url ?? "", songs: songs });
  }

  private static async fromSoundcloud(url: string = ""): Promise<Playlist> {
    let playlist;
    let tracks: SoundCloudTrack[] = [];
    try {
      playlist = await soundcloud(url);
      if (!playlist) throw new NoDataError();
      if (playlist.type === "playlist") {
      tracks = await (playlist as SoundCloudPlaylist).all_tracks();
      }
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError()
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  
    const songs = Playlist.getSongsFromSoundCloud(tracks);
    if (!songs.length) throw new NoDataError();

    return new this({ title: playlist.name, url: url, songs: songs });
  }

  private static async fromSpotify(url: string): Promise<Playlist> {
    let playlistPreview;
    let playlistTracks;
    try {
      playlistPreview = await getPreview(url, {headers: {'user-agent': bot.useragent}});
      playlistTracks = await getTracks(url, {headers: {'user-agent': bot.useragent}});
    } catch (error : any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }

    let infos: Promise<Video>[] = playlistTracks.map(async (track: any) => {
      return await youtube.searchOne(track.artist + " " + track.name);
    });
    const songs = Playlist.getSongsFromYoutube(await Promise.all(infos));
    if (!songs.length) throw new NoDataError();

    return new this({ title: playlistPreview.title, url: playlistPreview.link, songs: songs });
  }

  private static async fromDeezer(url: string): Promise<Playlist> {

    let playlist;
    try {
      playlist = await deezer(url);
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
    if (!playlist) throw new NoDataError();
    playlist = (playlist as DeezerPlaylist | DeezerAlbum);

    let infos: Promise<Video>[] = playlist.tracks.map(async (track) => {
      return await youtube.searchOne(track.artist.name + " " + track.title);
    });
    const songs = Playlist.getSongsFromYoutube(await Promise.all(infos));

    return new this({ title: playlist.title, url: playlist.url, songs: songs });
  }

  private static getSongsFromYoutube(playlist: Video[]): Song[] {

    let songs = playlist
      .filter((video) => (video.title ?? "") !== "" && video.title != "Private video" && video.title != "Deleted video")
      .slice(0, config.MAX_PLAYLIST_SIZE - 1)
      .map((video) => {
        return new Song({
          title: video.title!,
          url: `https://youtube.com/watch?v=${video.id}`,
          duration: video.duration,
          thumbnail: video.thumbnail?.url!
        });
      });
    if (!songs.length)
      throw new NoDataError();

    return songs;
  }

  private static getSongsFromSoundCloud(playlist: SoundCloudTrack[]): Song[] {

    let songs = playlist
      .slice(0, config.MAX_PLAYLIST_SIZE - 1)
      .map((track) => {
        return new Song({
          url: track.permalink,
          title: track.name,
          duration: track.durationInMs,
          thumbnail: track.thumbnail,
        });
      });
    if (!songs.length)
      throw new NoDataError();

    return songs;
  }
}