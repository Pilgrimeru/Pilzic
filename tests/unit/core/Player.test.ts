import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { EventEmitter } from "node:events";
import { config } from "config";
import type { BaseGuildTextChannel } from "discord.js";
import type { PlayerOptions } from "@custom-types/PlayerOptions";
import type { Player as PlayerType } from "@core/Player";

const audioPlayers: FakeAudioPlayer[] = [];
const removePlayer = mock(() => undefined);
const entersState = mock(async (target: unknown) => target);

class FakeAudioPlayer extends EventEmitter {
  public state = { status: "idle" };
  public readonly play = mock(() => undefined);
  public readonly pause = mock(() => true);
  public readonly unpause = mock(() => true);
  public readonly stop = mock(() => true);
}

mock.module("@discordjs/voice", () => ({
  AudioPlayerStatus: {
    AutoPaused: "autopaused",
    Buffering: "buffering",
    Idle: "idle",
    Paused: "paused",
    Playing: "playing",
  },
  NoSubscriberBehavior: { Pause: "pause" },
  VoiceConnectionStatus: {
    Connecting: "connecting",
    Destroyed: "destroyed",
    Disconnected: "disconnected",
    Ready: "ready",
    Signalling: "signalling",
  },
  createAudioPlayer: mock(() => {
    const player = new FakeAudioPlayer();
    audioPlayers.push(player);
    return player;
  }),
  createAudioResource: mock(() => ({})),
  entersState,
  StreamType: { Arbitrary: "arbitrary", OggOpus: "ogg/opus" },
}));

mock.module("index", () => ({
  bot: { playerManager: { removePlayer } },
}));

let PlayerClass: typeof PlayerType;

beforeAll(async () => {
  ({ Player: PlayerClass } = await import("@core/Player"));
});

const originalStayTime = config.STAY_TIME;

beforeEach(() => {
  config.STAY_TIME = 0;
  audioPlayers.length = 0;
  removePlayer.mockClear();
  entersState.mockClear();
});

afterEach(() => {
  config.STAY_TIME = originalStayTime;
});

const makePlayer = () => {
  const connection = new EventEmitter() as EventEmitter & {
    state: { status: string };
    subscribe: ReturnType<typeof mock>;
    destroy: ReturnType<typeof mock>;
    configureNetworking: ReturnType<typeof mock>;
  };
  connection.state = { status: "ready" };
  connection.subscribe = mock(() => undefined);
  connection.destroy = mock(() => {
    connection.state.status = "destroyed";
  });
  connection.configureNetworking = mock(() => undefined);

  const send = mock(async () => ({
    delete: mock(async () => undefined),
    edit: mock(async () => undefined),
    editable: true,
  }));
  const textChannel = {
    guildId: "guild-1",
    guild: { members: { me: { user: { id: "bot" } } } },
    send,
  } as unknown as BaseGuildTextChannel;
  const player = new PlayerClass({
    textChannel,
    connection,
  } as unknown as PlayerOptions);

  return {
    audioPlayer: audioPlayers.at(-1)!,
    connection,
    player,
    send,
  };
};

const markRunning = (player: InstanceType<typeof PlayerClass>) => {
  (player as unknown as { _stopped: boolean })._stopped = false;
};

describe("Player", () => {
  test("initialise et abonne un lecteur audio dans un état arrêté", () => {
    const { audioPlayer, connection, player } = makePlayer();

    expect(connection.subscribe).toHaveBeenCalledWith(audioPlayer);
    expect(player.status as unknown).toBe("idle");
    expect(player.playbackDuration).toBe(-1);
    expect(player.queue.tracks).toEqual([]);
  });

  test("accepte uniquement un volume compris entre 0 et 100", () => {
    const { player } = makePlayer();
    const initialVolume = player.volume;

    player.volume = 0;
    expect(player.volume).toBe(0);
    player.volume = 100;
    expect(player.volume).toBe(100);
    player.volume = -1;
    expect(player.volume).toBe(100);
    player.volume = 101;
    expect(player.volume).toBe(100);
    player.volume = Number.NaN;
    expect(player.volume).toBe(100);
    expect(initialVolume).toBe(config.DEFAULT_VOLUME);
  });

  test("délègue la reprise au lecteur audio", () => {
    const { audioPlayer, player } = makePlayer();

    expect(player.resume()).toBeTrue();
    expect(audioPlayer.unpause).toHaveBeenCalledTimes(1);
  });

  test("refuse une pause lorsque le lecteur ne joue pas", async () => {
    const { audioPlayer, player } = makePlayer();

    await expect(player.pause()).resolves.toBeFalse();
    expect(audioPlayer.pause).not.toHaveBeenCalled();
  });

  test("met en pause une lecture active", async () => {
    const { audioPlayer, player } = makePlayer();
    markRunning(player);
    audioPlayer.state.status = "playing";

    await expect(player.pause()).resolves.toBeTrue();

    expect(audioPlayer.pause).toHaveBeenCalledWith(true);
  });

  test("arrête le lecteur lors d'un skip pendant une lecture active", async () => {
    const { audioPlayer, player } = makePlayer();
    markRunning(player);
    audioPlayer.state.status = "playing";
    player.queue.enqueue({ title: "Piste" } as never);
    player.queue.enqueue({ title: "Piste suivante" } as never);

    await player.skip();

    expect(audioPlayer.stop).toHaveBeenCalledTimes(1);
  });

  test("ignore les commandes de navigation lorsqu'il est arrêté", async () => {
    const { audioPlayer, player } = makePlayer();

    await player.skip();
    await player.jumpTo(2);
    await player.previous();

    expect(audioPlayer.stop).not.toHaveBeenCalled();
    expect(audioPlayer.pause).not.toHaveBeenCalled();
  });

  test("quitte le salon et libère toutes les ressources", async () => {
    const { audioPlayer, connection, player, send } = makePlayer();

    await player.leave();

    expect(removePlayer).toHaveBeenCalledWith("guild-1");
    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(connection.listenerCount("disconnected")).toBe(0);
    expect(audioPlayer.eventNames()).toEqual([]);
    expect(player.queue.eventNames()).toEqual([]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
