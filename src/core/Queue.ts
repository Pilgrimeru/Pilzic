import { arrayMoveImmutable } from 'array-move';
import { Player } from './Player';
import { Playlist } from './Playlist';
import { Track } from './Track';
import { DataFinder } from './helpers/DataFinder';

type playlistAddedCallback = (playlist: Playlist) => any;
type trackAddedCallback = (track: Track) => any;

export class Queue {

  public loop: "queue" | "track" | "disabled";

  private _index: number;
  private _autoqueue: boolean;
  private player: Player;
  private _tracks: Track[] = [];
  private playlistAddedCallbacks: playlistAddedCallback[] = [];
  private trackAddedCallbacks: trackAddedCallback[] = [];

  constructor(player: Player) {
    this.loop = "disabled";
    this._index = 0;
    this._autoqueue = false;
    this.player = player;
    this.setupPlayerListeners();
  }

  public enqueue(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._tracks = this._tracks.concat(item.tracks);
      this.emiPlaylistAdded(item);
    } else {
      this._tracks.push(item);
      this.emitTrackAdded(item);
    }
  }

  public insert(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._tracks.splice(this.index + 1, 0, ...item.tracks);
      this.emiPlaylistAdded(item);
    } else {
      this._tracks.splice(this.index + 1, 0, item);
      this.emitTrackAdded(item);
    }
  }

  public clear(): void {
    this._index = 0;
    this._tracks.length = 0;
    this.loop = "disabled";
    this._autoqueue = false;
  }

  public shuffle(): void {
    let previousTracks = this.tracks.slice(0, this.index);
    let followingTracks = this.tracks.slice(this.index);

    for (let i = followingTracks.length - 1; i > 1; i--) {
      let j = 1 + Math.floor(Math.random() * i);
      [followingTracks[i], followingTracks[j]] = [followingTracks[j], followingTracks[i]];
    }
    this._tracks = previousTracks.concat(followingTracks);
  }

  public move(id1: number, id2: number): void {
    this._tracks = arrayMoveImmutable(this._tracks, id1, id2);
  }

  public remove(...idsToRemove: number[]): Track[] {
    let removed: Track[] = [];
    this._tracks = this._tracks.filter((track, trackIndex) => {
      if (idsToRemove.includes(trackIndex)) removed.push(track);
      else return true;
    });
    return removed;
  }

  public async toggleAutoqueue(): Promise<boolean> {
    this._autoqueue = !this._autoqueue;
    if (this._autoqueue) {
      await this.autoAddNextTrack();
    }
    return this._autoqueue;
  }

  public onTrackAdded(callback: trackAddedCallback) {
    this.trackAddedCallbacks.push(callback);
  }

  public onPlaylistAdded(callback: playlistAddedCallback) {
    this.playlistAddedCallbacks.push(callback);
  }

  public emitTrackAdded(track: Track) {
    this.trackAddedCallbacks.forEach(callback => callback(track));
  }

  public emiPlaylistAdded(playlist: Playlist) {
    this.playlistAddedCallbacks.forEach(callback => callback(playlist));
  }

  public canBack(): boolean {
    return this._index !== 0;
  }

  public canNext(): boolean {
    if (this.loop === "queue" || this.loop === "track") return true;
    return this._index !== (this._tracks.length - 1);
  }

  public get index(): number {
    return this._index;
  }

  public get tracks(): readonly Track[] {
    return this._tracks;
  }

  public get currentTrack(): Track | undefined {
    return this._tracks.at(this.index);
  }


  private setupPlayerListeners(): void {

    this.player.onSkip(() => {
      if (this._index !== this._tracks.length - 1) {
        this._index += 1;
        if (this._autoqueue) {
          this.autoAddNextTrack();
        }
      } else if (this.loop === "queue") {
        this._index = 0;
      }
    });

    this.player.onJump(trackId => {
      if (trackId >= this._tracks.length) trackId = this._tracks.length - 1;
      else if (trackId < 0) trackId = 0;
      if (this._autoqueue) {
        this.autoAddNextTrack();
      }
      this._index = trackId;
    });

    this.player.onPrevious(() => {
      if (this._index <= 0 && this.loop === "queue") {
        this._index = this._tracks.length - 1;
      }
      if (this._index >= 0) {
        this._index--;
      }
    });
  }

  private async autoAddNextTrack(): Promise<void> {
    const remainingTracks = this.tracks.length - this.index - 1;
    if (remainingTracks > 2) return;
    const botUser = this.player.textChannel.guild.members.me?.user!;

    let related_videos = await this._tracks[this._index].getRelated();
    related_videos = related_videos.filter((url) => !(this._tracks.some((existingTrack) => existingTrack.url === url)));
    if (!related_videos.length) return;

    const trackData = await DataFinder.getTrackDataFromLink(related_videos[0]).catch(console.error);
    if (!trackData) return;

    let relatedTrack = Track.from(trackData, botUser);
    this._tracks.push(relatedTrack);
  }
}