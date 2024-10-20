import { User } from 'discord.js';
import fetch from 'isomorphic-unfetch';
import { LRUCache } from 'lru-cache';
import { DeezerAlbum, DeezerPlaylist, SoundCloudPlaylist, SoundCloudTrack, deezer, soundcloud } from "play-dl";
import { Video, YouTube, Playlist as YoutubePlaylist } from "youtube-sr";
import { config } from "../config.js";
import {
  InvalidURLError,
  NoDataError,
  NothingFoundError,
  ServiceUnavailableError,
  YoutubeMixesError
} from '../errors/ExtractionErrors.js';
import type { UrlType } from '../utils/validate.js';
import { Bot } from './Bot.js';
import { Track, type SongData } from "./Track.js";
// @ts-ignore
import spotifyUrlInfo from 'spotify-url-info';
import type { PlaylistData } from '../types/extractor/PlaylistData.js';
const { getPreview, getTracks } = spotifyUrlInfo(fetch);

export class Playlist {
  private static playlistDataCache = new LRUCache<string, PlaylistData>({ max: 30 });

  public readonly title: string;
  public readonly url: string;
  public readonly songs: Track[];
  public readonly duration: number;

  private constructor(options: PlaylistData, requester: User) {
    this.title = options.title;
    this.url = options.url;
    this.duration = options.duration;
    this.songs = options.songs.map((data) => new Track(data, requester));
  }

  public static async from(search: string = "", requester: User, type: UrlType): Promise<Playlist> {
    const url = search.split(" ")[0];

    const cachedPlaylist = Playlist.playlistDataCache.get(search);
    if (cachedPlaylist) {
      return new Playlist(cachedPlaylist, requester);
    }

    try {
      let playlistData;
      switch (type) {
        case "sp_playlist":
        case "sp_album":
        case "sp_artist":
          playlistData = await Playlist.fromSpotify(url);
          break;
        case "so_playlist":
          playlistData = await Playlist.fromSoundcloud(url);
          break;
        case "dz_playlist":
        case "dz_album":
          playlistData = await Playlist.fromDeezer(url);
          break;
        default:
          if (type === false && url?.match(/^https?:\/\/\S+$/)) throw new InvalidURLError();
          playlistData = await Playlist.fromYoutube(url, search);
          break;
      }

      Playlist.playlistDataCache.set(search, playlistData);
      return new Playlist(playlistData, requester);
    } catch (error) {
      throw error;
    }
  }

  private static async fromYoutube(url: string = "", search: string = ""): Promise<PlaylistData> {
    const YT_LINK = /^((?:https?:)?\/\/)?(?:(?:www|m|music)\.)?((?:youtube\.com|youtu.be))\/.+$/;
    const urlValid = YouTube.isPlaylist(url);
    if (url.match(YT_LINK) && !urlValid) {
      throw new YoutubeMixesError();
    }

    try {
      let playlist: YoutubePlaylist;
      if (urlValid) {
        playlist = await YouTube.getPlaylist(url, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE
        });
        if (!playlist || !playlist.title || !playlist.url) {
          throw new InvalidURLError();
        }
      } else {
        const result = await YouTube.searchOne(search, "playlist", true);
        playlist = await YouTube.getPlaylist(result.url!, {
          fetchAll: true,
          limit: config.MAX_PLAYLIST_SIZE
        });
        if (!playlist || !playlist.title || !playlist.url) {
          throw new NothingFoundError();
        }
      }

      const songs = await Playlist.getSongsFromYoutube(playlist.videos);
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.title, url: playlist.url, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("Mixes")) {
        throw new YoutubeMixesError();
      }
      throw error;
    }
  }

  private static async fromSoundcloud(url: string = ""): Promise<PlaylistData> {
    try {
      let tracks: SoundCloudTrack[] = [];

      let playlist = await soundcloud(url);
      if (!playlist) {
        throw new NoDataError();
      }

      if (playlist.type === "playlist") {
        tracks = await (playlist as SoundCloudPlaylist).all_tracks();
      }

      const songs = await Playlist.getSongsFromSoundCloud(tracks);
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.name, url, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("out of scope")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("Data is missing")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  private static async fromSpotify(url: string = ""): Promise<PlaylistData> {
    try {
      let playlistPreview = await getPreview(url, { headers: { 'user-agent': Bot.useragent } });
      let playlistTracks = await getTracks(url, { headers: { 'user-agent': Bot.useragent } });

      const infos: Promise<Video>[] = playlistTracks.map((track: any) => {
        const search = track.artist + " " + track.name;
        return YouTube.searchOne(search, "video", true);
      });

      const songs = await Playlist.getSongsFromYoutube(await Promise.all(infos));
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlistPreview.title, url: playlistPreview.link, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("parse")) {
        throw new InvalidURLError();
      } else {
        throw new ServiceUnavailableError();
      }
    }
  }

  private static async fromDeezer(url: string = ""): Promise<PlaylistData> {
    try {
      let playlist = await deezer(url);

      if (!playlist) {
        throw new NoDataError();
      }
      playlist = (playlist as DeezerPlaylist | DeezerAlbum);

      const infos: Promise<Video>[] = playlist.tracks.map((track) => {
        const search = track.artist.name + " " + track.title;
        return YouTube.searchOne(search, "video", true);
      });

      const songs = await Playlist.getSongsFromYoutube(await Promise.all(infos));
      const duration = songs.reduce((total, song) => total + song.duration, 0);

      return { title: playlist.title, url: playlist.url, songs, duration };
    } catch (error: any) {
      if (error.message?.includes("not a Deezer")) {
        throw new InvalidURLError();
      } else if (error.message?.includes("API Error")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }
  }

  private static async getSongsFromYoutube(videos: Video[]): Promise<SongData[]> {
    const validVideos = videos.filter((video) =>
      video && video.title && video.title !== "Private video" && video.title !== "Deleted video" && !video.nsfw
    );

    if (!validVideos.length) {
      throw new NoDataError();
    }

    return validVideos.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((video) => ({
      title: video.title!,
      url: `https://youtube.com/watch?v=${video.id}`,
      duration: video.duration,
      thumbnail: video.thumbnail?.url!,
    }));
  }

  private static async getSongsFromSoundCloud(tracks: SoundCloudTrack[]): Promise<SongData[]> {
    if (!tracks.length) {
      throw new NoDataError();
    }

    return tracks.slice(0, config.MAX_PLAYLIST_SIZE - 1).map((track) => ({
      url: track.permalink,
      title: track.name,
      duration: track.durationInMs,
      thumbnail: track.thumbnail,
    }));
  }
}