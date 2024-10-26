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
import { BaseGuildTextChannel } from 'discord.js';
import { config } from 'config';
import { i18n } from 'i18n.config';
import { bot } from 'index';
import type { PlayerOptions } from "@custom-types/PlayerOptions";
import { autoDelete } from '@utils/autoDelete';
import { formatTime } from '@utils/formatTime';
import { NowPlayingMsgManager } from './managers/NowPlayingMsgManager';
import { Playlist } from './Playlist';
import { Queue } from './Queue';
import { Track } from './Track';

type skipCallback = () => any;
type previousCallback = () => any;
type jumpCallback = (trackId: number) => any;

export class Player {

  public readonly textChannel!: BaseGuildTextChannel;
  public readonly queue: Queue;

  private readonly connection!: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;
  private readonly nowPlayingMsgManager: NowPlayingMsgManager;
  private resource: AudioResource | undefined;

  private _volume: number;
  private _stopped: boolean;

  private skipCallbacks: skipCallback[] = [];
  private previousCallbacks: previousCallback[] = [];
  private jumpCallbacks: jumpCallback[] = [];

  public constructor(options: PlayerOptions) {
    Object.assign(this, options);
    this._stopped = true;
    this._volume = config.DEFAULT_VOLUME;

    this.queue = new Queue(this);
    this.nowPlayingMsgManager = new NowPlayingMsgManager(this);

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 30,
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });
    this.connection.subscribe(this.audioPlayer);

    this.setupConnectionListeners();
    this.setupAudioPlayerListeners();
    this.setupQueueListeners();
  }

  public async skip(): Promise<void> {
    if (this._stopped) return;
    if (!this.queue.canNext()) {
      this.textChannel.send(i18n.__("player.queueEnded")).then(autoDelete);
      return this.stop();
    }
    if (this.audioPlayer.state.status === "playing") {
      this.audioPlayer.stop();
      return;
    }

    this.nowPlayingMsgManager.delete();
    this.emitSkip();
    const newCurrent = this.queue.currentTrack;
    newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async jumpTo(trackId: number): Promise<void> {
    if (this._stopped) return;
    this.audioPlayer.pause(true);
    this.nowPlayingMsgManager.delete();
    this.emitJump(trackId);
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async previous(): Promise<void> {
    if (!this.queue.canBack()) return;
    this.audioPlayer.pause(true);
    this.nowPlayingMsgManager.delete();
    this.emitPrevious();
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async seek(time: number): Promise<void> {
    this.nowPlayingMsgManager.delete();
    this.audioPlayer.pause(true);
    const current = this.queue.currentTrack;
    return current ? this.process(current, time) : this.stop();
  }

  public async pause(): Promise<boolean> {
    const result = this.audioPlayer.pause();
    await this.nowPlayingMsgManager.edit();
    return result;
  }

  public resume(): boolean {
    return this.audioPlayer.unpause();
  }

  public stop(): void {
    if (this._stopped) return;
    this._stopped = true;
    this.queue.clear();
    this.nowPlayingMsgManager.delete();
    this.audioPlayer.stop();
    this.resource?.playStream?.destroy();

    setTimeout(() => {
      if (this._stopped) {
        this.leave();
      }
    }, config.STAY_TIME * 1000);
  }

  public leave(): void {
    this.stop();
    if (this.connection.state.status != VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
      this.textChannel.send(i18n.__("player.leaveChannel")).then(autoDelete);
    }
    bot.playerManager.removePlayer(this.textChannel.guildId);
  }

  public onSkip(callback: skipCallback) {
    this.skipCallbacks.push(callback);
  }

  public onJump(callback: jumpCallback) {
    this.jumpCallbacks.push(callback);
  }

  public onPrevious(callback: previousCallback) {
    this.previousCallbacks.push(callback);
  }

  private emitSkip() {
    this.skipCallbacks.forEach(callback => callback());
  }

  private emitJump(trackId: number) {
    this.jumpCallbacks.forEach(callback => callback(trackId));
  }

  private emitPrevious() {
    this.previousCallbacks.forEach(callback => callback());
  }

  public get volume(): number {
    return this._volume;
  }

  public set volume(v: number) {
    if (v >= 0 && v <= 100) {
      this._volume = v;
      this.resource?.volume?.setVolumeLogarithmic(this._volume / 100);
    }
  }

  public get playbackDuration(): number {
    return this.resource?.playbackDuration ?? -1;
  }

  public get status(): AudioPlayerStatus {
    return this.audioPlayer.state.status;
  }


  private async process(track: Track, seek?: number): Promise<void> {
    const loadingMsg = this.textChannel.send(i18n.__("common.loading"));
    try {
      this.resource = await track.makeResource(seek);
      if (!this.resource.readable) throw new Error("Resource not readable.");
      this.resource.playbackDuration += (seek ?? 0) * 1000;
      this.resource.volume?.setVolumeLogarithmic(this._volume / 100);
      (await loadingMsg).delete().catch(() => null);
      this.audioPlayer.play(this.resource);
      await this.nowPlayingMsgManager.send(track);
    } catch (error) {
      console.error(error);
      (await loadingMsg).delete().catch(() => null);
      this.textChannel.send(i18n.__("player.error")).then(autoDelete);
      await this.skip();
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
        this.nowPlayingMsgManager.edit();
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

    this.audioPlayer.on(AudioPlayerStatus.Playing, async () => {
      this.nowPlayingMsgManager.edit();
    });

    this.audioPlayer.on("error", (error) => {
      console.error(error);
      this.textChannel.send(i18n.__("player.error")).then(autoDelete);
      this.skip();
    });
  }

  private async setupQueueListeners(): Promise<void> {

    this.queue.onTrackAdded(track => {
      this.sendTrackAddedMessage(track);
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentTrack;
        return current ? this.process(current) : this.stop();
      }
    });

    this.queue.onPlaylistAdded(playlist => {
      this.sendPlaylistAddedMessage(playlist);
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentTrack;
        return current ? this.process(current) : this.stop();
      }
    });
  }

  private sendTrackAddedMessage(track: Track): void {
    const embed = {
      description: i18n.__mf("player.trackAdded", {
        title: track.title,
        url: track.url
      }),
      color: config.COLORS.MAIN
    };
    this.textChannel.send({ embeds: [embed] }).then(autoDelete);
  }

  private sendPlaylistAddedMessage(playlist: Playlist): void {
    const embed = {
      description: i18n.__mf("player.playlistAdded", {
        title: playlist.title,
        url: playlist.url,
        length: playlist.tracks.length,
        duration: formatTime(playlist.duration)
      }),
      color: config.COLORS.MAIN
    };
    this.textChannel.send({ embeds: [embed] }).then(autoDelete);
  }
}