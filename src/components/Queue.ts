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
  private _autoqueue : boolean = false;
  private player : Player;

  private playlistAddedCallbacks: playlistAddedCallback[] = [];
  private songAddedCallbacks: songAddedCallback[] = [];

  constructor(player : Player) {
    this.player = player;
    this.setupPlayerListeners();
  }

  public enqueue(item: Song | Playlist) : void {
    if (item instanceof Playlist) {
      this._songs.push(...item.songs);
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


  public getAutoqueue(): boolean {
    return this._autoqueue;
  }

  public async setAutoqueue(value: boolean) {
    this._autoqueue = value;
    await this.autoFill();
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
      if (this._index !== this._songs.length - 1) {
        this._index += 1;
        if (this._autoqueue) {
          this.autoFill();
        }
      } else if (this.loop === "queue") {
        this._index = 0;
      }
    });

    this.player.onJump(songId => {
      if (songId >= this._songs.length) songId = this._songs.length -1;
      else if (songId < 0) songId = 0;
      if (this._autoqueue) {
        this.autoFill();
      }
      this._index = songId;
    })

    this.player.onPrevious(() => {
      if (this._index <= 0 && this.loop === "queue") {
        this._index = this._songs.length - 1;
      }
      if (this._index >= 0) {
        this._index--;
      }
    })
  }

  private async autoFill() : Promise<number> {
    const MAX_FILL = 4;
    const remainingTracks = this.songs.length - this.index - 1;
    if (remainingTracks > 2 || remainingTracks >= MAX_FILL) return 0;

    const randomPreviousIndex = Math.floor(Math.random() * (this.index + 1));
    const limit = MAX_FILL - remainingTracks;
    const botUser = this.player.textChannel.guild.members.me?.user!
    
    let related_videos = await this._songs[randomPreviousIndex].getRelated();
    related_videos = related_videos.filter((url) => !this._songs.some((existingSong) => existingSong.url === url));

    let songs: Song[] = [];
    for (const url of related_videos) {
      if (limit && songs.length >= limit) break;
        
      try {
        const song = await Song.from(url, botUser, "yt_video");
        songs.push(song);
      } catch (error) {
        console.error(error);
      }
    }
    this._songs.push(...songs);
    if (songs.length < limit) await this.autoFill();
    return songs.length;
  }
}