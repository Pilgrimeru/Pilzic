import arrayMove from 'array-move';
import { Player } from './Player';
import { Playlist } from "./Playlist";
import { Song } from "./Song";

type playlistAddedCallback = (playlist : Playlist) => any;
type songAddedCallback = (song : Song) => any;

export class Queue {
  
  public loop : "queue" | "track" | "disabled" = "disabled";
  
  private _index: number = 0;
  private _songs: Song[] = [];
  private player : Player;

  private playlistAddedCallbacks: playlistAddedCallback[] = [];
  private songAddedCallbacks: songAddedCallback[] = [];

  constructor(player : Player) {
    this.player = player;
    this.setupPlayerListeners();
  }

  public enqueue(item: Song | Playlist) : void {
    if (item instanceof Playlist) {
      this._songs = this._songs.concat(item.songs);
      this.playlistAddedCallbacks.forEach(callback => callback(item));

    } else {
      this._songs.push(item);
      this.songAddedCallbacks.forEach(callback => callback(item));
    }
  }

  public insert(item: Song | Playlist) : void {
    if (item instanceof Playlist) {
      this._songs.splice(this.index + 1, 0, ...item.songs);
      this.playlistAddedCallbacks.forEach(callback => callback(item));
    } else {
      this._songs.splice(this.index + 1, 0, item);
      this.songAddedCallbacks.forEach(callback => callback(item));
    }
  }

  public clear() : void {
    this._index = 0;
    this._songs.length = 0;
    this.loop = "disabled";
    this._autoqueue = false;
  }

  public shuffle() : void {
    let previousSongs = this.songs.slice(0, this.index);
    let followingSongs = this.songs.slice(this.index);

    for (let i = followingSongs.length - 1; i > 1; i--) {
      let j = 1 + Math.floor(Math.random() * i);
      [followingSongs[i], followingSongs[j]] = [followingSongs[j], followingSongs[i]];
    }
    this._songs = previousSongs.concat(followingSongs);
  }

  public move(id1 : number, id2 : number) : void {
    this._songs = arrayMove(this._songs, id1, id2);
  }

  public remove(...idsToRemove : number[]) : Song[] {
    let removed: Song[] = [];
      this._songs = this._songs.filter((song, songIndex) => {
        if (idsToRemove.includes(songIndex)) removed.push(song);
        else return true;
      });
    return removed;
  }

  public onSongAdded(callback: songAddedCallback) {
    this.songAddedCallbacks.push(callback);
  }

  public onPlaylistAdded(callback: playlistAddedCallback) {
    this.playlistAddedCallbacks.push(callback);
  }

  public canBack() : boolean {
    return this._index !== 0;
  }

  public canNext() : boolean {
    if (this.loop === "queue" || this.loop === "track") return true;
    return this._index !== (this._songs.length - 1);
  }


  public get index() : number {
    return this._index;
  }

  public get songs() : readonly Song[] {
    return this._songs;
  }

  public get currentSong() : Song | undefined {
    return this._songs.at(this.index);
  }
  

  private setupPlayerListeners() : void {
    
    this.player.onSkip(() => {
      if (this.loop === "track") this.loop = "disabled";
      if (this._index !== this._songs.length - 1) {
        this._index += 1;
      } else if (this.loop === "queue") {
        this._index = 0;
      }
    });

    this.player.onJump(songId => {
      if (this.loop === "track") this.loop = "disabled";
      if (songId >= this._songs.length) songId = this._songs.length -1;
      else if (songId < 0) songId = 0;
      this._index = songId;
    })

    this.player.onPrevious(() => {
      if (this.loop === "track") this.loop = "disabled";
      
      if (this._index <= 0 && this.loop === "queue") {
        this._index = this._songs.length - 1;
      }
      if (this._index >= 0) {
        this._index--;
      }
    })
  }
}