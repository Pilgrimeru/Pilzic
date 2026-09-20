import { describe, expect, test } from "bun:test";
import { Queue } from "@core/Queue";
import { Track } from "@core/Track";
import { config } from "config";
import type { Player } from "@core/Player";
import type { User } from "discord.js";
import { EventEmitter } from "node:events";

const requester = { id: "requester" } as User;
const makeTrack = (index: number): Track =>
  Track.from(
    {
      url: `https://example.test/${index}`,
      title: `Piste ${index}`,
      duration: index * 1_000,
      thumbnail: null,
    },
    requester,
  );

const makeQueue = () => {
  const player = new EventEmitter() as unknown as Player;
  return { player, queue: new Queue(player) };
};

describe("Queue", () => {
  test("ajoute, insère et expose les prochaines pistes sans muter la vue", () => {
    const { queue } = makeQueue();
    const first = makeTrack(1);
    const second = makeTrack(2);
    const inserted = makeTrack(3);

    queue.enqueue(first);
    queue.enqueue(second);
    queue.insert(inserted);

    expect(queue.currentTrack).toBe(first);
    expect(queue.upcoming(2)).toEqual([inserted, second]);
    expect(queue.tracks).toEqual([first, inserted, second]);
  });

  test("suit les événements de navigation du lecteur", () => {
    const { player, queue } = makeQueue();
    const tracks = [makeTrack(1), makeTrack(2), makeTrack(3)];
    tracks.forEach((item) => queue.enqueue(item));

    player.emit("skip");
    expect(queue.index).toBe(1);
    expect(queue.currentTrack).toBe(tracks[1]);

    player.emit("previous");
    expect(queue.index).toBe(0);

    player.emit("jump", 99);
    expect(queue.index).toBe(2);
    player.emit("jump", -10);
    expect(queue.index).toBe(0);
  });

  test("boucle entre la fin et le début de la file", () => {
    const { player, queue } = makeQueue();
    queue.enqueue(makeTrack(1));
    queue.enqueue(makeTrack(2));
    queue.loop = "queue";

    player.emit("jump", 1);
    player.emit("skip");
    expect(queue.index).toBe(0);

    player.emit("previous");
    expect(queue.index).toBe(1);
  });

  test("retire les pistes demandées et les retourne dans leur ordre", () => {
    const { queue } = makeQueue();
    const tracks = [makeTrack(1), makeTrack(2), makeTrack(3), makeTrack(4)];
    tracks.forEach((item) => queue.enqueue(item));

    expect(queue.remove(1, 3)).toEqual([tracks[1], tracks[3]]);
    expect(queue.tracks).toEqual([tracks[0], tracks[2]]);
  });

  test("diffère la piste courante à la fin de la file", () => {
    const { queue } = makeQueue();
    const tracks = [makeTrack(1), makeTrack(2), makeTrack(3)];
    tracks.forEach((item) => queue.enqueue(item));

    expect(queue.deferCurrent()).toBe(tracks[1]);
    expect(queue.tracks).toEqual([tracks[1], tracks[2], tracks[0]]);
  });

  test("élague l'historique après les changements de piste", () => {
    const { player, queue } = makeQueue();
    const count = config.QUEUE_HISTORY_SIZE + 3;
    for (let index = 0; index < count; index++) queue.enqueue(makeTrack(index));

    for (let index = 0; index < count - 1; index++) player.emit("skip");

    expect(queue.index).toBe(config.QUEUE_HISTORY_SIZE);
    expect(queue.tracks).toHaveLength(config.QUEUE_HISTORY_SIZE + 1);
    expect(queue.currentTrack?.title).toBe(`Piste ${count - 1}`);
  });

  test("réinitialise entièrement son état", async () => {
    const { queue } = makeQueue();
    queue.enqueue(makeTrack(1));
    queue.loop = "queue";

    queue.clear();

    expect(queue.tracks).toEqual([]);
    expect(queue.index).toBe(0);
    expect(queue.loop as string).toBe("disabled");
    expect(queue.currentTrack).toBeUndefined();
  });
});
