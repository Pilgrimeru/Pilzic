import { arrayMoveImmutable } from "array-move";
import { config } from "config";
import { EventEmitter } from "events";
import type { Player } from "./Player";
import { Playlist } from "./Playlist";
import { Track } from "./Track";
import { DataFinder } from "./helpers/DataFinder";

export class Queue extends EventEmitter {
  public loop: "queue" | "track" | "disabled";

  private _index: number;
  private _autoqueue: boolean;
  private autoAddPromise: Promise<void> | undefined;
  private readonly player: Player;
  private _tracks: Track[] = [];

  constructor(player: Player) {
    super();
    this.loop = "disabled";
    this._index = 0;
    this._autoqueue = false;
    this.player = player;
    this.setupPlayerListeners();
  }

  public enqueue(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._tracks = this._tracks.concat(item.tracks);
      this.emit("playlistAdded", item);
    } else {
      this._tracks.push(item);
      this.emit("trackAdded", item);
    }
  }

  public insert(item: Track | Playlist): void {
    if (item instanceof Playlist) {
      this._tracks.splice(this.index + 1, 0, ...item.tracks);
      this.emit("playlistAdded", item);
    } else {
      this._tracks.splice(this.index + 1, 0, item);
      this.emit("trackAdded", item);
    }
  }

  public clear(): void {
    this._index = 0;
    this._tracks.length = 0;
    this.loop = "disabled";
    this._autoqueue = false;
  }

  public shuffle(): void {
    const previousTracks = this.tracks.slice(0, this.index);
    const followingTracks = this.tracks.slice(this.index);

    for (let i = followingTracks.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(Math.random() * i);
      [followingTracks[i], followingTracks[j]] = [
        followingTracks[j],
        followingTracks[i],
      ];
    }
    this._tracks = previousTracks.concat(followingTracks);
  }

  public move(id1: number, id2: number): void {
    this._tracks = arrayMoveImmutable(this._tracks, id1, id2);
  }

  public remove(...idsToRemove: number[]): Track[] {
    const removed: Track[] = [];
    this._tracks = this._tracks.filter((track, trackIndex) => {
      if (idsToRemove.includes(trackIndex)) {
        removed.push(track);
        return false;
      }
      return true;
    });
    return removed;
  }

  public async toggleAutoqueue(): Promise<boolean> {
    this._autoqueue = !this._autoqueue;
    if (this._autoqueue) {
      await this.scheduleAutoAdd();
    }
    return this._autoqueue;
  }

  public canBack(): boolean {
    return this._index !== 0;
  }

  public canNext(): boolean {
    if (this._tracks.length === 0) return false;
    if (this.loop === "queue" || this.loop === "track") return true;
    return this._index !== this._tracks.length - 1;
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

  public upcoming(limit: number): readonly Track[] {
    return this._tracks.slice(this._index + 1, this._index + 1 + limit);
  }

  public deferCurrent(): Track | undefined {
    if (this._index >= this._tracks.length - 1) return this.currentTrack;
    const [track] = this._tracks.splice(this._index, 1);
    if (track) this._tracks.push(track);
    return this.currentTrack;
  }

  private setupPlayerListeners(): void {
    this.player.on("skip", () => {
      if (this._index !== this._tracks.length - 1) {
        this._index += 1;
        this.pruneHistory();
        if (this._autoqueue) {
          void this.scheduleAutoAdd();
        }
      } else if (this.loop === "queue") {
        this._index = 0;
      }
    });

    this.player.on("jump", (trackId: number) => {
      if (this._tracks.length === 0) {
        this._index = 0;
        return;
      }
      if (trackId >= this._tracks.length) trackId = this._tracks.length - 1;
      else if (trackId < 0) trackId = 0;
      if (this._autoqueue) {
        void this.scheduleAutoAdd();
      }
      this._index = trackId;
    });

    this.player.on("previous", () => {
      if (this._index <= 0 && this.loop === "queue") {
        this._index = this._tracks.length - 1;
      } else if (this._index > 0) {
        this._index--;
      }
    });
  }

  private pruneHistory(): void {
    if (this.loop === "queue") return;
    const excess = this._index - config.QUEUE_HISTORY_SIZE;
    if (excess <= 0) return;
    this._tracks.splice(0, excess);
    this._index -= excess;
  }

  private scheduleAutoAdd(): Promise<void> {
    if (!this.autoAddPromise) {
      this.autoAddPromise = this.autoAddNextTrack().finally(() => {
        this.autoAddPromise = undefined;
      });
    }
    return this.autoAddPromise;
  }

  private async autoAddNextTrack(): Promise<void> {
    if (!this._autoqueue) return;
    const remainingTracks = this.tracks.length - this.index - 1;
    if (remainingTracks > 2) return;
    const current = this._tracks[this._index];
    if (!current) return;
    const botUser = this.player.textChannel.guild.members.me?.user!;

    let related_videos = await current.getRelated();
    related_videos = related_videos.filter(
      (url) => !this._tracks.some((existingTrack) => existingTrack.url === url),
    );
    if (!related_videos.length) return;

    const trackData = await DataFinder.getTrackDataFromLink(
      related_videos[0],
    ).catch(console.error);
    if (!trackData || !this._autoqueue) return;

    const relatedTrack = Track.from(trackData, botUser);
    this._tracks.push(relatedTrack);
  }
}
