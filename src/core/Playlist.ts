import { User } from 'discord.js';
import { config } from '../config.js';
import type { PlaylistData } from '../types/extractor/PlaylistData.js';
import type { TrackData } from '../types/extractor/TrackData.js';
import { Track } from "./Track.js";

export class Playlist {
  public readonly title: string;
  public readonly url: string;
  public readonly tracks: Track[];
  public readonly duration: number;

  private constructor(options: PlaylistData, requester: User) {
    this.title = options.title;
    this.url = options.url;
    this.duration = options.duration;
    this.tracks = this.filterPlaylist(options.tracks).map((data) => Track.from(data, requester));
  }

  public static async from(playlistData: PlaylistData, requester: User): Promise<Playlist> {
    return new Playlist(playlistData, requester);
  }

  private filterPlaylist(tracks: TrackData[]) {
    return tracks.filter((track) => track && track.url).slice(0, config.MAX_PLAYLIST_SIZE - 1);
  }
}