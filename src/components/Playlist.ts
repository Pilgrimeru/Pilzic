import { User } from 'discord.js';
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
import { UrlType } from '../utils/validate';
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
  public readonly duration: number;


  public constructor(options: PlaylistData) {
    Object.assign(this, options);
    let total = 0;
    options.songs.forEach((songs) => {total += songs.duration});
    this.duration = total;
  }


  public static async from(search: string = "", requester: User, type: UrlType): Promise<Playlist> {
    const url = search.split(" ").at(0);

    if (type === false) throw new InvalidURLError();

    if (type === "sp_playlist" || type === "sp_album" || type === "sp_artist") {
      return await Playlist.fromSpotify(url, requester);
    }
    if (type === "so_playlist") {
      return await Playlist.fromSoundcloud(url, requester);
    }
    if (type === "dz_playlist" || type === "dz_album") {
      return await Playlist.fromDeezer(url, requester);
    }
    
    return await Playlist.fromYoutube(url, search, requester);
  }


  private static async fromYoutube(url: string = "", search: string = "", requester: User): Promise<Playlist> {
    const YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;
    const urlValid = youtube.isPlaylist(url);
    if (url.match(YT_LINK) && !urlValid) throw new YoutubeMixesError();

    let playlist: YoutubePlaylist;
    try {
      if (urlValid) {
        playlist = await youtube.getPlaylist(url, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE 
        });
        if (!playlist) throw new InvalidURLError();
        
      } else {
        const result = await youtube.searchOne(search, "playlist");
        if (!result) throw new NothingFoundError();
        playlist = await result.fetch(config.MAX_PLAYLIST_SIZE);
      }
    } catch (error : any) {
      if (error.message?.includes("Mixes")) {
        throw new YoutubeMixesError();
      }
      throw error;
    }
    const songs = Playlist.getSongsFromYoutube(playlist.videos, requester);

    return new this({ title: playlist.title ?? "unknown", url: playlist.url ?? "", songs: songs });
  }

  private static async fromSoundcloud(url: string = "", requester: User): Promise<Playlist> {
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
  
    const songs = Playlist.getSongsFromSoundCloud(tracks, requester);
    if (!songs.length) throw new NoDataError();

    return new this({ title: playlist.name, url: url, songs: songs });
  }

  private static async fromSpotify(url: string = "", requester: User): Promise<Playlist> {
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
    const songs = Playlist.getSongsFromYoutube(await Promise.all(infos), requester);
    if (!songs.length) throw new NoDataError();

    return new this({ title: playlistPreview.title, url: playlistPreview.link, songs: songs });
  }

  private static async fromDeezer(url: string = "", requester: User): Promise<Playlist> {

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
    const songs = Playlist.getSongsFromYoutube(await Promise.all(infos), requester);

    return new this({ title: playlist.title, url: playlist.url, songs: songs });
  }

  private static getSongsFromYoutube(playlist: Video[], requester: User): Song[] {

    let songs = playlist
      .filter((video) => (video.title ?? "") !== "" && video.title != "Private video" && video.title != "Deleted video")
      .slice(0, config.MAX_PLAYLIST_SIZE - 1)
      .map((video) => {
        return new Song({
          title: video.title!,
          url: `https://youtube.com/watch?v=${video.id}`,
          duration: video.duration,
          thumbnail: video.thumbnail?.url!
        }, requester);
      });
    if (!songs.length)
      throw new NoDataError();

    return songs;
  }

  private static getSongsFromSoundCloud(playlist: SoundCloudTrack[], requester: User): Song[] {

    let songs = playlist
      .slice(0, config.MAX_PLAYLIST_SIZE - 1)
      .map((track) => {
        return new Song({
          url: track.permalink,
          title: track.name,
          duration: track.durationInMs,
          thumbnail: track.thumbnail,
        }, requester);
      });
    if (!songs.length)
      throw new NoDataError();

    return songs;
  }
}