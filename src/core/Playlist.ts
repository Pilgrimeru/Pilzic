import type { PlaylistData } from '@custom-types/extractor/PlaylistData';
import type { TrackData } from '@custom-types/extractor/TrackData';
import { config } from 'config';
import { User } from 'discord.js';
import { Track } from './Track';

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