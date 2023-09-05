import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState
} from "@discordjs/voice";
import { BaseGuildTextChannel, Message } from "discord.js";
import { config } from "../config";
import { i18n } from "../i18n.config";
import { bot } from "../index";
import { PlayerOptions } from "../interfaces/PlayerOptions";
import { purning } from "../utils/purning";
import { nowPlayingMsg } from "./NowPlayingMsg";
import { Playlist } from "./Playlist";
import { Queue } from "./Queue";
import { Song } from "./Song";

type skipCallback = () => any;
type previousCallback = () => any;
type skipToCallback = (id : number) => any;


export class Player {

  public readonly textChannel: BaseGuildTextChannel;
  public readonly queue : Queue;

  private readonly connection: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;
  private resource: AudioResource;
  private loadingMsg : Message;
  private nowPlayingMsg: nowPlayingMsg | undefined = undefined;
  private _volume = config.DEFAULT_VOLUME;
  private _stopped = true;

  private skipCallbacks: skipCallback[] = [];
  private previousCallbacks: previousCallback[] = [];
  private skipToCallbacks: skipToCallback[] = [];
  
  
  public constructor(options: PlayerOptions) {
    Object.assign(this, options);
    bot.players.set(this.textChannel.guildId, this);

    this.queue = new Queue(this);
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 45,
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });
    this.connection.subscribe(this.audioPlayer);
    
    this.setupConnectionListeners();
    this.setupAudioPlayerListeners();
    this.setupQueueListeners();
  }
  

  public skip() : void {
    if (this._stopped) return;
    if (!this.queue.canNext()) {
      this.textChannel.send(i18n.__("player.queueEnded")).then(purning);
      return this.stop();
    }
    this.audioPlayer.pause();
    this.nowPlayingMsg?.stop();
    // Send the "skip" request to the queue.
    this.skipCallbacks.forEach(callback => callback());
    const newCurrent = this.queue.currentSong;
    newCurrent ? this.process(newCurrent) : this.stop();
  }

  public skipTo(id: number) : void {
    if (this._stopped) return;
    this.audioPlayer.pause();
    this.nowPlayingMsg?.stop();
    // Send the "skipTo" request to the queue.
    this.skipToCallbacks.forEach(callback => callback(id));
    const newCurrent = this.queue.currentSong;
    newCurrent ? this.process(newCurrent) : this.stop();
  }

  public previous() : void {
    if (!this.queue.canBack()) return;
    this.audioPlayer.pause();
    this.nowPlayingMsg?.stop();
    // Send the "previous" request to the queue.
    this.previousCallbacks.forEach(callback => callback());
    const newCurrent = this.queue.currentSong;
    newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async seek(time : number) : Promise<void> {
    this.nowPlayingMsg?.stop();
    this.pause();
    const current = this.queue.currentSong;
    current ? await this.process(current, time) : this.stop();
  }

  public pause() : boolean {
    return this.audioPlayer.pause();
  }

  public resume() : boolean {
    return this.audioPlayer.unpause();
  }

  public stop() : void {
    if (this._stopped) return;
    this._stopped = true;
    this.queue.clear();
    this.nowPlayingMsg?.stop();
    this.audioPlayer.stop();
    this.resource?.playStream?.destroy();

    setTimeout(() => {
      if (this._stopped) {
        this.leave();
      }
    }, config.STAY_TIME * 1000);
  }

  public leave() : void {
    this.connection.removeAllListeners();
    this.audioPlayer.removeAllListeners();
    if (this.connection.state.status != VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
      this.textChannel.send(i18n.__("player.leaveChannel")).then(purning);
    }
    bot.players.delete(this.textChannel.guildId);
  }

  public onSkip(callback: skipCallback) {
    this.skipCallbacks.push(callback);
  }

  public onSkipTo(callback: skipToCallback) {
    this.skipToCallbacks.push(callback);
  }

  public onPrevious(callback: previousCallback) {
    this.previousCallbacks.push(callback);
  }


  public get volume() : number {
    return this._volume;
  }

  public set volume(v : number) {
    if (v >= 0 && v <= 100) {
      this._volume = v;
      this.resource?.volume?.setVolumeLogarithmic(this._volume / 100);
    }
  }

  public get playbackDuration() : number {
    return this.resource.playbackDuration;
  }

  public get status() : AudioPlayerStatus {
    return this.audioPlayer.state.status;
  }
  

  private async process(song : Song, seek? : number): Promise<void> {
    try {
      this.loadingMsg = await this.textChannel.send(i18n.__("common.loading"));
      this.resource = await song.makeResource(seek);
      this.resource.playbackDuration += (seek ?? 0) * 1000;
      this.resource.volume?.setVolumeLogarithmic(this._volume / 100);
      this.loadingMsg?.delete().catch(() => null);
      this.audioPlayer.play(this.resource);
      this.nowPlayingMsg = new nowPlayingMsg(this);
      this.nowPlayingMsg.send(song);
    } catch (error) {
      console.error(error);
      this.loadingMsg?.delete().catch(() => null);
      this.textChannel.send(i18n.__("player.error")).then(purning);
      this.skip();
    }
  }

  private async setupConnectionListeners(): Promise<void> {
    this.connection.on(VoiceConnectionStatus.Disconnected, async (_, disconnection) => {
      if ((disconnection.reason == 0 && disconnection.closeCode == 4014) || disconnection.reason == 3) {
        return this.stop();
      }
      try {
        this.connection.configureNetworking();
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch (error) {
        console.error(error);
        this.stop();
      }
    });
  }

  private async setupAudioPlayerListeners(): Promise<void> {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.skip();
    });

    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, async () => {
      try {
        if (!this._stopped) {
          this.connection.configureNetworking();
        }
        this.connection.subscribe(this.audioPlayer);

        await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
      } catch (error) {
        console.error(error);
        this.skip();
      }
    });

    this.audioPlayer.on("error", (error) => {
      console.error(error);
      this.skip();
    });
  }

  private async setupQueueListeners(): Promise<void> {

    this.queue.onSongAdded( song => {
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentSong;
        current ? this.process(current) : this.stop();
      }
      this.sendSongAddedMessage(song);
    });

    this.queue.onPlaylistAdded( playlist => {
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentSong;
        current ? this.process(current) : this.stop();
      }
      this.sendPlaylistAddedMessage(playlist);
    });
  }

  private sendSongAddedMessage(song: Song): void {
    const embed = {
      description: i18n.__mf("player.songAdded", {
        title: song.title,
        url: song.url
      }),
      color: 0x69adc7
    };
    this.textChannel.send({ embeds: [embed] }).then(purning);
  }

  private sendPlaylistAddedMessage(playlist: Playlist): void {
    const embed = {
      description: i18n.__mf("player.playlistAdded", {
        title: playlist.title,
        url: playlist.url,
        length: playlist.songs.length
      }),
      color: 0x69adc7
    };
    this.textChannel.send({ embeds: [embed] }).then(purning);
  }
}