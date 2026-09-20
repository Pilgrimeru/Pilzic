import { describe, expect, test } from "bun:test";
import { Extractor } from "@core/extractors/abstract/Extractor";
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

describe("Extractor", () => {
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
    expect(first).toBe(data);
    expect(second).toBe(data);
    expect(third).toBe(data);
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
    await expect(extractor.extract("track")).resolves.toBe(expected);
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
});
