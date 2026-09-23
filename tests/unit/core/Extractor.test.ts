import { beforeEach, describe, expect, test } from "bun:test";
import { Extractor } from "@core/extractors/abstract/Extractor";
import { cacheManager } from "@core/managers/CacheManager";
import type { PlaylistData } from "@custom-types/extractor/PlaylistData";
import type { TrackData } from "@custom-types/extractor/TrackData";

const trackData = (url: string): TrackData => ({
  url,
  title: `Titre ${url}`,
  duration: 1_000,
  thumbnail: null,
});

class ControlledExtractor extends Extractor {
  public calls = 0;

  public constructor(
    private readonly key: string,
    private readonly implementation: () => Promise<TrackData>,
  ) {
    super("track");
  }

  protected getCacheKey(): string {
    return this.key;
  }

  protected fetchData(): Promise<TrackData> {
    this.calls++;
    return this.implementation();
  }
}

class ControlledPlaylistExtractor extends Extractor {
  public calls = 0;

  public constructor(
    private readonly key: string,
    private readonly data: PlaylistData,
  ) {
    super("playlist");
  }

  protected getCacheKey(): string {
    return this.key;
  }

  protected async fetchData(): Promise<PlaylistData> {
    this.calls++;
    return this.data;
  }
}

beforeEach(() => cacheManager.clear());

describe("Extractor", () => {
  test("impose l'implémentation de validate aux sous-classes", async () => {
    await expect(Extractor.validate("https://example.test")).rejects.toThrow(
      "Must be implemented by subclass",
    );
  });

  test("mutualise les extractions simultanées ayant la même clé", async () => {
    const data = trackData("https://example.test/single-flight");
    const extractor = new ControlledExtractor(
      `unit:single-flight:${crypto.randomUUID()}`,
      async () => {
        await Bun.sleep(10);
        return data;
      },
    );

    const [first, second, third] = await Promise.all([
      extractor.extract("track"),
      extractor.extract("track"),
      extractor.extract("track"),
    ]);

    expect(extractor.calls).toBe(1);
    expect(first).toEqual(data);
    expect(second).toEqual(data);
    expect(third).toEqual(data);
    expect(first).not.toBe(second);
  });

  test("supprime une extraction échouée de la table des requêtes en cours", async () => {
    const expected = trackData("https://example.test/retry");
    const extractor = new ControlledExtractor(
      `unit:retry:${crypto.randomUUID()}`,
      async () => {
        if (extractor.calls === 1) throw new Error("premier appel en échec");
        return expected;
      },
    );

    await expect(extractor.extract("track")).rejects.toThrow(
      "premier appel en échec",
    );
    await expect(extractor.extract("track")).resolves.toEqual(expected);
    expect(extractor.calls).toBe(2);
  });

  test("ne mutualise pas deux clés différentes", async () => {
    let totalCalls = 0;
    const makeExtractor = (key: string) =>
      new ControlledExtractor(key, async () => {
        totalCalls++;
        return trackData(key);
      });

    await Promise.all([
      makeExtractor(`unit:a:${crypto.randomUUID()}`).extract("track"),
      makeExtractor(`unit:b:${crypto.randomUUID()}`).extract("track"),
    ]);

    expect(totalCalls).toBe(2);
  });

  test("réutilise une extraction séquentielle depuis le cache", async () => {
    const data = trackData("https://example.test/cached");
    const extractor = new ControlledExtractor(
      `unit:cache:${crypto.randomUUID()}`,
      async () => data,
    );

    const first = await extractor.extract("track");
    const second = await extractor.extract("track");

    expect(first).toEqual(data);
    expect(second).toEqual(data);
    expect(second).not.toBe(data);
    expect(extractor.calls).toBe(1);
  });

  test("extrait une PlaylistData sans construire le domaine", async () => {
    const data: PlaylistData = {
      title: "Liste",
      url: "https://example.test/list",
      duration: 1_000,
      tracks: [trackData("https://example.test/list/1")],
    };
    const extractor = new ControlledPlaylistExtractor(
      `unit:build-playlist:${crypto.randomUUID()}`,
      data,
    );

    const result = await extractor.extract("playlist");

    expect(result).toEqual(data);
    expect(extractor.calls).toBe(1);
  });
});
