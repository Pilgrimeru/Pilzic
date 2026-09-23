import { describe, expect, test } from "bun:test";
import { AudioJobScheduler } from "@core/helpers/AudioJobScheduler";

describe("AudioJobScheduler", () => {
  test("limite les jobs simultanés et donne la priorité à la lecture", async () => {
    const scheduler = new AudioJobScheduler(1);
    const first = await scheduler.acquire();
    const order: string[] = [];
    const preload = scheduler.acquire(0).then((release) => {
      order.push("preload");
      release();
    });
    const playback = scheduler.acquire(1).then((release) => {
      order.push("playback");
      release();
    });
    first();
    await Promise.all([preload, playback]);
    expect(order).toEqual(["playback", "preload"]);
  });

  test("retire une demande annulée sans consommer de place", async () => {
    const scheduler = new AudioJobScheduler(1);
    const release = await scheduler.acquire();
    const controller = new AbortController();
    const cancelled = scheduler.acquire(0, controller.signal);
    controller.abort(new Error("cancelled"));
    await expect(cancelled).rejects.toThrow("cancelled");
    release();
    release();
    const next = await scheduler.acquire();
    next();
  });

  test("borne 50 jobs concurrents à quatre exécutions actives", async () => {
    const scheduler = new AudioJobScheduler(4);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 50 }, async () => {
        const release = await scheduler.acquire();
        active++;
        peak = Math.max(peak, active);
        await Bun.sleep(1);
        active--;
        release();
      }),
    );
    expect(peak).toBe(4);
    expect(scheduler.snapshot()).toMatchObject({
      active: 0,
      queued: 0,
      peak: 4,
    });
  });
});
