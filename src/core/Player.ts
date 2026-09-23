import type { PlayerOptions } from "@custom-types/PlayerOptions";
import type {
  AudioPlayer,
  AudioResource,
  VoiceConnection,
} from "@discordjs/voice";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
} from "@discordjs/voice";
import { autoDelete } from "@utils/autoDelete";
import { formatTime } from "@utils/formatTime";
import { config } from "config";
import type { BaseGuildTextChannel } from "discord.js";
import { EventEmitter } from "events";
import { randomUUID } from "node:crypto";
import { i18n } from "i18n.config";
import { audioResourceFactory } from "./AudioResourceFactory";
import { classifyAudioFailure } from "./helpers/AudioFailure";
import { coreMetrics } from "./helpers/CoreMetrics";
import { observe } from "./helpers/observe";
import { NowPlayingMsgManager } from "./managers/NowPlayingMsgManager";
import type { Playlist } from "./Playlist";
import { Queue } from "./Queue";
import type { Track } from "./Track";

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
  private transitionController: AbortController | undefined;
  private preloadController: AbortController | undefined;
  private pendingStartup: { jobId: string; startedAt: number } | undefined;
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly onLeave?: (guildId: string) => void;

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
      observe(
        this.textChannel.send(i18n.__("player.queueEnded")).then(autoDelete),
        "queue ended message",
      );
      return this.stop();
    }
    if (this.audioPlayer.state.status === "playing") {
      const transitionId = ++this.transitionId;
      const resource = this.resource;
      if (!(await this.fadeOut(resource, transitionId))) return;
      this.cancelAudioJobs();
      // Let @discordjs/voice append its silence padding instead of cutting an
      // Opus frame in the middle, which produces an audible click.
      this.audioPlayer.stop();
      return;
    }

    observe(this.nowPlayingMsgManager.clear(), "now playing clear");
    this.emit("skip");
    const newCurrent = this.queue.currentTrack;
    newCurrent ? await this.process(newCurrent) : this.stop();
  }

  public async jumpTo(trackId: number): Promise<void> {
    if (this._stopped) return;
    if (!(await this.prepareNavigation())) return;
    observe(this.nowPlayingMsgManager.clear(), "now playing clear");
    this.emit("jump", trackId);
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async previous(): Promise<void> {
    if (!this.queue.canBack()) return;
    if (!(await this.prepareNavigation())) return;
    observe(this.nowPlayingMsgManager.clear(), "now playing clear");
    this.emit("previous");
    const newCurrent = this.queue.currentTrack;
    return newCurrent ? this.process(newCurrent) : this.stop();
  }

  public async seek(time: number): Promise<void> {
    if (this._stopped) return;
    observe(this.nowPlayingMsgManager.clear(), "now playing clear");
    if (!(await this.prepareNavigation())) return;
    const current = this.queue.currentTrack;
    return current ? this.process(current, time) : this.stop();
  }

  public async pause(): Promise<boolean> {
    const result = await this.fadeAndPause();
    await this.nowPlayingMsgManager.update();
    return result;
  }

  public resume(): boolean {
    if (
      this.audioPlayer.state.status === AudioPlayerStatus.Paused &&
      this.resource &&
      !this.resource.volume &&
      this._volume !== 100
    ) {
      observe(
        this.seek(Math.max(0, this.playbackDuration / 1000)),
        "resume with adjusted volume",
      );
      return true;
    }
    return this.audioPlayer.unpause();
  }

  public async stop(): Promise<void> {
    if (this._stopped) return;
    this._stopped = true;
    const transitionId = ++this.transitionId;
    this.cancelAudioJobs();
    const resource = this.resource;
    this.queue.clear();
    observe(this.nowPlayingMsgManager.clear(), "now playing clear");

    if (await this.fadeOut(resource, transitionId)) {
      // A non-forced stop sends the resource's configured silence padding.
      // The voice player owns and disposes the stream after reaching Idle.
      this.audioPlayer.stop();
      this.resource = undefined;
    }

    this.cancelLeaveTimer();
    if (config.STAY_TIME === 0) return;
    this.leaveTimer = setTimeout(() => {
      this.leaveTimer = undefined;
      if (this._stopped) {
        observe(this.leave(), "leave voice channel");
      }
    }, config.STAY_TIME * 1000);
    this.leaveTimer.unref?.();
  }

  public async leave(): Promise<void> {
    this.cancelLeaveTimer();
    await this.stop();
    this.cancelLeaveTimer();
    this.onLeave?.(this.textChannel.guildId);
    if (this.connection.state.status != VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
      this.connection.removeAllListeners();
      this.audioPlayer.removeAllListeners();
      this.queue.removeAllListeners();
      this.removeAllListeners();
      observe(
        this.textChannel.send(i18n.__("player.leaveChannel")).then(autoDelete),
        "leave channel message",
      );
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

  private async prepareNavigation(): Promise<boolean> {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing)
      return this.fadeAndPause();
    ++this.transitionId;
    this.cancelAudioJobs();
    this.audioPlayer.stop();
    return true;
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
      if (this.resource?.volume) {
        this.resource.volume.setVolumeLogarithmic(this._volume / 100);
      } else if (
        this.resource &&
        v !== 100 &&
        this.audioPlayer.state.status === AudioPlayerStatus.Playing
      ) {
        observe(
          this.seek(Math.max(0, this.playbackDuration / 1000)),
          "adjust volume on direct stream",
        );
      }
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
    this.cancelAudioJobs();
    const controller = new AbortController();
    this.transitionController = controller;
    const jobId = randomUUID();
    this.pendingStartup = { jobId, startedAt: performance.now() };
    try {
      await entersState(
        this.connection,
        VoiceConnectionStatus.Ready,
        AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      );
      if (controller.signal.aborted || processId !== this.transitionId) return;
      const resource = await audioResourceFactory.createResource(
        track,
        seek,
        controller.signal,
        this._volume,
      );
      if (processId !== this.transitionId || this._stopped) {
        resource.playStream.destroy();
        return;
      }
      if (!resource.readable) throw new Error("Resource not readable.");
      resource.playbackDuration += (seek ?? 0) * 1000;
      resource.volume?.setVolumeLogarithmic(this._volume / 100);
      this.resource = resource;
      this.audioPlayer.play(resource);
      // The transition controller only owns startup work. Once the resource
      // belongs to the audio player, aborting this controller on the next
      // transition would tear down the currently playing stream and surface
      // as a spurious "Premature close" error.
      if (this.transitionController === controller) {
        this.transitionController = undefined;
      }
      await this.nowPlayingMsgManager.send(track).catch(console.error);
    } catch (error) {
      if (processId !== this.transitionId || this._stopped) return;
      this.pendingStartup = undefined;
      coreMetrics.recordFailure(this.textChannel.guildId, jobId, error);
      console.error(error);
      observe(
        this.textChannel.send(i18n.__("player.error")).then(autoDelete),
        "player error message",
      );
      await this.handlePlaybackFailure(error);
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
          observe(this.stop(), "voice disconnected");
          return;
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
          observe(this.stop(), "voice reconnect failed");
        }
      },
    );
  }

  private setupAudioPlayerListeners(): void {
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      if (this.handlingFailure) return;
      const completed = this.queue.currentTrack;
      if (completed) this.queueRetries.delete(completed);
      observe(this.skip(), "skip idle player");
    });

    this.audioPlayer.on(AudioPlayerStatus.AutoPaused, async () => {
      try {
        observe(this.nowPlayingMsgManager.update(), "now playing update");
        if (!this._stopped) {
          this.connection.configureNetworking();
        }
        this.connection.subscribe(this.audioPlayer);

        await entersState(this.audioPlayer, AudioPlayerStatus.Playing, 5_000);
      } catch (error) {
        console.error(error);
        observe(this.skip(), "skip after auto pause");
      }
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, async () => {
      if (this.pendingStartup) {
        coreMetrics.recordStartup(
          this.textChannel.guildId,
          this.pendingStartup.jobId,
          performance.now() - this.pendingStartup.startedAt,
        );
        this.pendingStartup = undefined;
      }
      observe(this.nowPlayingMsgManager.update(), "now playing update");
      this.preloadController?.abort();
      const controller = new AbortController();
      this.preloadController = controller;
      for (const track of this.queue.upcoming(config.AUDIO_PRELOAD_COUNT)) {
        void audioResourceFactory
          .preload(track, controller.signal)
          .catch(console.error);
      }
    });

    this.audioPlayer.on("error", (error) => {
      if (error.resource !== this.resource) return;
      if (this.pendingStartup) {
        coreMetrics.recordFailure(
          this.textChannel.guildId,
          this.pendingStartup.jobId,
          error,
        );
        this.pendingStartup = undefined;
      }
      console.error(error);
      observe(
        this.textChannel.send(i18n.__("player.error")).then(autoDelete),
        "player error message",
      );
      observe(this.handlePlaybackFailure(error), "playback failure");
    });
  }

  private async handlePlaybackFailure(error: unknown): Promise<void> {
    if (this.handlingFailure || this._stopped) return;
    this.handlingFailure = true;
    try {
      const current = this.queue.currentTrack;
      const failure = classifyAudioFailure(error);
      if (failure.kind === "auth") {
        console.error(
          "[YouTube] Queue stopped: run `bun run youtube-login` locally and replace the cookie file.",
        );
        return this.stop();
      }
      if (current && failure.retryable) {
        const retries = this.queueRetries.get(current) ?? 0;
        if (retries < 1) {
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
      this.cancelLeaveTimer();
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentTrack;
        return current ? this.process(current) : this.stop();
      }
      this.sendTrackAddedMessage(track);
    });

    this.queue.on("playlistAdded", (playlist: Playlist) => {
      this.cancelLeaveTimer();
      this.sendPlaylistAddedMessage(playlist);
      if (this._stopped) {
        this._stopped = false;
        const current = this.queue.currentTrack;
        return current ? this.process(current) : this.stop();
      }
    });
  }

  private cancelLeaveTimer(): void {
    if (!this.leaveTimer) return;
    clearTimeout(this.leaveTimer);
    this.leaveTimer = undefined;
  }

  private cancelAudioJobs(): void {
    if (this.pendingStartup) {
      coreMetrics.recordCancellation();
      this.pendingStartup = undefined;
    }
    this.transitionController?.abort(
      new Error("Playback transition superseded"),
    );
    this.transitionController = undefined;
    this.preloadController?.abort(new Error("Preload window changed"));
    this.preloadController = undefined;
  }

  private sendTrackAddedMessage(track: Track): void {
    const embed = {
      description: i18n.__mf("player.trackAdded", {
        title: track.title,
        url: track.url,
      }),
      color: config.COLORS.MAIN,
    };
    observe(
      this.textChannel.send({ embeds: [embed] }).then(autoDelete),
      "track added message",
    );
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
    observe(
      this.textChannel.send({ embeds: [embed] }).then(autoDelete),
      "playlist added message",
    );
  }
}
