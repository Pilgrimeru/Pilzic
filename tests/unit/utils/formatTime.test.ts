import { describe, expect, test } from "bun:test";
import { formatTime } from "@utils/formatTime";

describe("formatTime", () => {
  test.each([
    [0, "00:00"],
    [999, "00:01"],
    [60_000, "01:00"],
    [3_599_499, "59:59"],
    [3_600_000, "01:00:00"],
    [90_061_000, "25:01:01"],
  ])("formate %i ms en %s", (milliseconds, expected) => {
    expect(formatTime(milliseconds)).toBe(expected);
  });
});
