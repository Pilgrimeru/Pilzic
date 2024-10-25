import { arrayMoveImmutable } from 'array-move';
import { Player } from './Player.js';
import { Playlist } from "./Playlist.js";
import { Track } from "./Track.js";
import { DataFinder } from './helpers/DataFinder.js';

type playlistAddedCallback = (playlist: Playlist) => any;
type songAddedCallback = (track: Track) => any;

export class Queue {

  public loop: "queue" | "track" | "disabled";

  private _index: number;
  private _autoqueue: boolean;
  private player: Player;
  private _songs: Track[] = [];
  private playlistAddedCallbacks: playlistAddedCallback[] = [];
  private songAddedCallbacks: songAddedCallback[] = [];

  constructor(player: Player) {
    this.loop = "disabled";
    this._index = 0;
    this._autoqueue = false;
    this.player = player;
    this.setupPlayerListeners();
  }

  public enqueue(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._songs = this._songs.concat(item.tracks);
      this.emiPlaylistAdded(item);
    } else {
      this._songs.push(item);
      this.emitSongAdded(item)
    }
  }

  public insert(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._songs.splice(this.index + 1, 0, ...item.tracks);
      this.emiPlaylistAdded(item);
    } else {
      this._songs.splice(this.index + 1, 0, item);
      this.emitSongAdded(item)
    }
  }

  public clear(): void {
    this._index = 0;
    this._songs.length = 0;
    this.loop = "disabled";
    this._autoqueue = false;
  }

  public shuffle(): void {
    let previousSongs = this.tracks.slice(0, this.index);
    let followingSongs = this.tracks.slice(this.index);

    for (let i = followingSongs.length - 1; i > 1; i--) {
      let j = 1 + Math.floor(Math.random() * i);
      [followingSongs[i], followingSongs[j]] = [followingSongs[j], followingSongs[i]];
    }
    this._songs = previousSongs.concat(followingSongs);
  }

  public move(id1: number, id2: number): void {
    this._songs = arrayMoveImmutable(this._songs, id1, id2);
  }

  public remove(...idsToRemove: number[]): Track[] {
    let removed: Track[] = [];
    this._songs = this._songs.filter((track, songIndex) => {
      if (idsToRemove.includes(songIndex)) removed.push(track);
      else return true;
    });
    return removed;
  }

  public async toggleAutoqueue(): Promise<boolean> {
    this._autoqueue = !this._autoqueue;
    if (this._autoqueue) {
      await this.autoAddNextSong();
    }
    return this._autoqueue;
  }

  public onSongAdded(callback: songAddedCallback) {
    this.songAddedCallbacks.push(callback);
  }

  public onPlaylistAdded(callback: playlistAddedCallback) {
    this.playlistAddedCallbacks.push(callback);
  }

  public emitSongAdded(track: Track) {
    this.songAddedCallbacks.forEach(callback => callback(track));
  }

  public emiPlaylistAdded(playlist: Playlist) {
    this.playlistAddedCallbacks.forEach(callback => callback(playlist));
  }

  public canBack(): boolean {
    return this._index !== 0;
  }

  public canNext(): boolean {
    if (this.loop === "queue" || this.loop === "track") return true;
    return this._index !== (this._songs.length - 1);
  }

  public get index(): number {
    return this._index;
  }

  public get tracks(): readonly Track[] {
    return this._songs;
  }

  public get currentSong(): Track | undefined {
    return this._songs.at(this.index);
  }


  private setupPlayerListeners(): void {

    this.player.onSkip(() => {
      if (this._index !== this._songs.length - 1) {
        this._index += 1;
        if (this._autoqueue) {
          this.autoAddNextSong();
        }
      } else if (this.loop === "queue") {
        this._index = 0;
      }
    });

    this.player.onJump(songId => {
      if (songId >= this._songs.length) songId = this._songs.length - 1;
      else if (songId < 0) songId = 0;
      if (this._autoqueue) {
        this.autoAddNextSong();
      }
      this._index = songId;
    });

    this.player.onPrevious(() => {
      if (this._index <= 0 && this.loop === "queue") {
        this._index = this._songs.length - 1;
      }
      if (this._index >= 0) {
        this._index--;
      }
    });
  }

  private async autoAddNextSong(): Promise<void> {
    const remainingTracks = this.tracks.length - this.index - 1;
    if (remainingTracks > 2) return;
    const botUser = this.player.textChannel.guild.members.me?.user!;

    let related_videos = await this._songs[this._index].getRelated();
    related_videos = related_videos.filter((url) => !(this._songs.some((existingSong) => existingSong.url === url)));
    if (!related_videos.length) return;

    const trackData = await DataFinder.getTrackDataFromLink(related_videos[0]).catch(console.error);
    if (!trackData) return;

    let relatedSong = Track.from(trackData, botUser);
    this._songs.push(relatedSong);
  }
}