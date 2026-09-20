import { describe, expect, test } from "bun:test";
import { mapWithConcurrency } from "@utils/mapWithConcurrency";

describe("mapWithConcurrency", () => {
  test("conserve l'ordre des résultats malgré des durées différentes", async () => {
    const results = await mapWithConcurrency([30, 5, 15], 3, async (delay) => {
      await Bun.sleep(delay);
      return delay * 2;
    });

    expect(results).toEqual([
      { status: "fulfilled", value: 60 },
      { status: "fulfilled", value: 10 },
      { status: "fulfilled", value: 30 },
    ]);
  });

  test("ne dépasse jamais la limite de concurrence", async () => {
    let active = 0;
    let maximumActive = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Bun.sleep(5);
      active--;
    });

    expect(maximumActive).toBe(2);
  });

  test("isole les rejets sans interrompre les autres traitements", async () => {
    const error = new Error("échec attendu");
    const results = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) throw error;
      return value;
    });

    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1]).toEqual({ status: "rejected", reason: error });
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  test("utilise au moins un worker si la concurrence est invalide", async () => {
    const results = await mapWithConcurrency([1, 2], 0, async (value) => value);

    expect(results).toEqual([
      { status: "fulfilled", value: 1 },
      { status: "fulfilled", value: 2 },
    ]);
  });

  test.each([NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "normalise une concurrence non finie (%s)",
    async (concurrency) => {
      const visited: number[] = [];
      const results = await mapWithConcurrency(
        [1, 2],
        concurrency,
        async (value) => {
          visited.push(value);
          return value;
        },
      );

      expect(visited).toEqual([1, 2]);
      expect(results).toHaveLength(2);
    },
  );

  test("arrondit la concurrence décimale sans dépasser la limite", async () => {
    let active = 0;
    let maximumActive = 0;

    await mapWithConcurrency([1, 2, 3, 4], 2.9, async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await Bun.sleep(2);
      active--;
    });

    expect(maximumActive).toBe(2);
  });

  test("transmet au mapper la valeur et l'index exacts", async () => {
    const calls: Array<[string, number]> = [];

    await mapWithConcurrency(["a", "b", "c"], 2, async (value, index) => {
      calls.push([value, index]);
      return index;
    });

    expect(calls.sort((a, b) => a[1] - b[1])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  test("gère une entrée vide", async () => {
    expect(await mapWithConcurrency([], 4, async (value) => value)).toEqual([]);
  });
});
