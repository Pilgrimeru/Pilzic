import type { PlayerOptions } from "@custom-types/PlayerOptions";
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
} from "@discordjs/voice";
import { autoDelete } from "@utils/autoDelete";
import { formatTime } from "@utils/formatTime";
import { config } from "config";
import { BaseGuildTextChannel } from "discord.js";
import { EventEmitter } from "events";
import { i18n } from "i18n.config";
import { bot } from "index";
import { audioResourceFactory } from "./AudioResourceFactory";
import { YouTubeStreamError } from "./helpers/YouTubeStreamConverter";
import { NowPlayingMsgManager } from "./managers/NowPlayingMsgManager";
import { Playlist } from "./Playlist";
import { Queue } from "./Queue";
import { Track } from "./Track";

export class Player extends EventEmitter {
  private static readonly FADE_OUT_DURATION_MS = 40;
  private static readonly FADE_OUT_STEPS = 4;

  public readonly textChannel!: BaseGuildTextChannel;
  public readonly queue: Queue;

  private readonly connection!: VoiceConnection;
  private readonly audioPlayer: AudioPlayer;
  private readonly nowPlayingMsgManager: NowPlayingMsgManager;
  private resource: AudioResource | undefined;

  private _volume: number;
  private _stopped: boolean;
  private readonly queueRetries = new WeakMap<Track, number>();
  private handlingFailure = false;
  private transitionId = 0;

  public constructor(options: PlayerOptions) {
    super();
    Object.assign(this, options);
    this._stopped = true;
    this._volume = config.DEFAULT_VOLUME;

    this.queue = new Queue(this);
    this.nowPlayingMsgManager = new NowPlayingMsgManager(this);

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 30,
        noSubscriber: NoSubscriberBehavior.Pause,
      },
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
      const transitionId = ++this.transitionId;
      const resource = this.resource;
      if (!(await this.fadeOut(resource, transitionId))) return;
      // Let @discordjs/voice append its silence padding instead of cutting an
      // Opus frame in the middle, which produces an audible click.
      this.audioPlayer.stop();
      return;
    }

    void this.nowPlayingMsgManager.clear();
    this.emit("skip");
    const newCurrent = this.queue.currentTrack;
    newCurrent ? await this.process(newCurrent) : this.stop();
  }

  public async jumpTo(trackId: number): Promise<void> {
    if (this._stopped) return;
    if (!(await this.fadeAndPause())) return;
    void this.nowPlayingMsgManager.clear();
    this.emit("jump", trackId);
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async previous(): Promise<void> {
    if (!this.queue.canBack()) return;
    if (!(await this.fadeAndPause())) return;
    void this.nowPlayingMsgManager.clear();
    this.emit("previous");
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async seek(time: number): Promise<void> {
    void this.nowPlayingMsgManager.clear();
    if (!(await this.fadeAndPause())) return;
    const current = this.queue.currentTrack;
    return current ? this.process(current, time) : this.stop();
  }

  public async pause(): Promise<boolean> {
    const result = await this.fadeAndPause();
    await this.nowPlayingMsgManager.update();
    return result;
  }

  public resume(): boolean {
    return this.audioPlayer.unpause();
  }

  public async stop(): Promise<void> {
    if (this._stopped) return;
    this._stopped = true;
    const transitionId = ++this.transitionId;
    const resource = this.resource;
    this.queue.clear();
    void this.nowPlayingMsgManager.clear();

    if (await this.fadeOut(resource, transitionId)) {
      // A non-forced stop sends the resource's configured silence padding.
      // The voice player owns and disposes the stream after reaching Idle.
      this.audioPlayer.stop();
      this.resource = undefined;
    }

    setTimeout(() => {
      if (this._stopped) {
        void this.leave();
      }
    }, config.STAY_TIME * 1000);
  }

  public async leave(): Promise<void> {
    await this.stop();
    bot.playerManager.removePlayer(this.textChannel.guildId);
    if (this.connection.state.status != VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
      this.connection.removeAllListeners();
      this.audioPlayer.removeAllListeners();
      this.queue.removeAllListeners();
      this.removeAllListeners();
      this.textChannel.send(i18n.__("player.leaveChannel")).then(autoDelete);
    }
  }

  private async fadeAndPause(): Promise<boolean> {
    if (this.audioPlayer.state.status !== AudioPlayerStatus.Playing)
      return false;
    const transitionId = ++this.transitionId;
    const resource = this.resource;
    if (!(await this.fadeOut(resource, transitionId))) return false;

    const paused = this.audioPlayer.pause(true);
    // No audio is consumed while paused, so restoring now makes resume start at
    // the user's configured volume without an audible jump.
    resource?.volume?.setVolumeLogarithmic(this._volume / 100);
    return paused;
  }

  private async fadeOut(
    resource: AudioResource | undefined,
    transitionId: number,
  ): Promise<boolean> {
    const volume = resource?.volume;
    if (!volume) return transitionId === this.transitionId;
    const startVolume = volume.volume;

    for (let step = 1; step <= Player.FADE_OUT_STEPS; step++) {
      await new Promise<void>((resolve) =>
        setTimeout(
          resolve,
          Player.FADE_OUT_DURATION_MS / Player.FADE_OUT_STEPS,
        ),
      );
      if (transitionId !== this.transitionId || resource !== this.resource)
        return false;
      volume.setVolume(startVolume * (1 - step / Player.FADE_OUT_STEPS));
    }
    return true;
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
    const processId = ++this.transitionId;
    const loadingMsg = this.textChannel.send(i18n.__("common.loading"));
    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 15_000);
      const resource = await audioResourceFactory.createResource(track, seek);
      if (processId !== this.transitionId || this._stopped) {
        resource.playStream.destroy();
        return;
      }
      if (!resource.readable) throw new Error("Resource not readable.");
      resource.playbackDuration += (seek ?? 0) * 1000;
      resource.volume?.setVolumeLogarithmic(this._volume / 100);
      this.resource = resource;
      this.audioPlayer.play(resource);
      await this.nowPlayingMsgManager.send(track);
    } catch (error) {
      if (processId !== this.transitionId || this._stopped) return;
      console.error(error);
      this.textChannel.send(i18n.__("player.error")).then(autoDelete);
      await this.handlePlaybackFailure(error);
    } finally {
      (await loadingMsg).delete().catch(() => null);
    }
  }

  private setupConnectionListeners(): void {
    this.connection.on(
      VoiceConnectionStatus.Disconnected,
      async (_, disconnection) => {
        if (
          (disconnection.reason == 0 && disconnection.closeCode == 4014) ||
          disconnection.reason == 3
        ) {
          return this.stop();
        }
        try {
          this.connection.configureNetworking();
          await Promise.race([
            entersState(
              this.connection,
              VoiceConnectionStatus.Signalling,
              5_000,
            ),
            entersState(
              this.connection,
              VoiceConnectionStatus.Connecting,
              5_000,
            ),
          ]);
        } catch (error) {
          console.error(error);
          this.stop();
        }
      },
    );
  }

  private setupAudioPlayerListeners(): void {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      if (this.handlingFailure) return;
      const completed = this.queue.currentTrack;
      if (completed) this.queueRetries.delete(completed);
      void this.skip();
    });

    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, async () => {
      try {
        void this.nowPlayingMsgManager.update();
        if (!this._stopped) {
          this.connection.configureNetworking();
        }
        this.connection.subscribe(this.audioPlayer);

        await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
      } catch (error) {
        console.error(error);
        await this.skip();
      }
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, async () => {
      void this.nowPlayingMsgManager.update();
      for (const track of this.queue.upcoming(config.AUDIO_PRELOAD_COUNT)) {
        void audioResourceFactory.preload(track);
      }
    });

    this.audioPlayer.on("error", (error) => {
      console.error(error);
      this.textChannel.send(i18n.__("player.error")).then(autoDelete);
      void this.handlePlaybackFailure(error);
    });
  }

  private async handlePlaybackFailure(error: unknown): Promise<void> {
    if (this.handlingFailure || this._stopped) return;
    this.handlingFailure = true;
    try {
      const current = this.queue.currentTrack;
      const message = error instanceof Error ? error.message : String(error);
      if (
        error instanceof YouTubeStreamError &&
        error.code === "YOUTUBE_AUTH_REQUIRED"
      ) {
        console.error(
          "[YouTube] Queue stopped: run `bun run youtube-login` locally and replace the cookie file.",
        );
        return this.stop();
      }
      const transient =
        (error instanceof YouTubeStreamError &&
          error.code === "YOUTUBE_TRANSIENT") ||
        /econnreset|socket hang up|timed out|premature|broken pipe|http error 50[0234]/i.test(
          message,
        );
      if (current && transient) {
        const retries = this.queueRetries.get(current) ?? 0;
        if (retries < 2) {
          this.queueRetries.set(current, retries + 1);
          const next = this.queue.deferCurrent();
          if (next) {
            this.handlingFailure = false;
            return await this.process(next);
          }
        }
      }
      this.handlingFailure = false;
      await this.skip();
    } finally {
      this.handlingFailure = false;
    }
  }

  private setupQueueListeners(): void {
    this.queue.on("trackAdded", (track: Track) => {
      this.sendTrackAddedMessage(track);
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentTrack;
        return current ? this.process(current) : this.stop();
      }
    });

    this.queue.on("playlistAdded", (playlist: Playlist) => {
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
        url: track.url,
      }),
      color: config.COLORS.MAIN,
    };
    this.textChannel.send({ embeds: [embed] }).then(autoDelete);
  }

  private sendPlaylistAddedMessage(playlist: Playlist): void {
    const embed = {
      description: i18n.__mf("player.playlistAdded", {
        title: playlist.title,
        url: playlist.url,
        length: playlist.tracks.length,
        duration: formatTime(playlist.duration),
      }),
      color: config.COLORS.MAIN,
    };
    this.textChannel.send({ embeds: [embed] }).then(autoDelete);
  }
}
