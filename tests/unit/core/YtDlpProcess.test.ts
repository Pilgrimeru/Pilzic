import { expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareYtDlpCookies } from "@core/helpers/YtDlpProcess";

test("isolates writable cookies for concurrent extractions and preserves the secret", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "pilzic-test-"));
  const source = path.join(directory, "source.txt");
  const original = "# Netscape HTTP Cookie File\n";
  writeFileSync(source, original, { mode: 0o400 });
  const args = ["--cookies", source, "--skip-download"];
  const first = prepareYtDlpCookies(args);
  const second = prepareYtDlpCookies(args);
  try {
    expect(first.args[1]).not.toBe(source);
    expect(first.args[1]).not.toBe(second.args[1]);
    expect(readFileSync(first.args[1], "utf8")).toBe(original);
    writeFileSync(first.args[1], "updated cookie jar");
    expect(readFileSync(source, "utf8")).toBe(original);
    expect(readFileSync(second.args[1], "utf8")).toBe(original);
    expect(args).toEqual(["--cookies", source, "--skip-download"]);
    first.cleanup();
    expect(existsSync(first.args[1])).toBeFalse();
    expect(existsSync(second.args[1])).toBeTrue();
  } finally {
    first.cleanup();
    second.cleanup();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("leaves extraction arguments unchanged without cookies", () => {
  const args = ["--skip-download"];
  const prepared = prepareYtDlpCookies(args);
  expect(prepared.args).toEqual(args);
  prepared.cleanup();
});

test("rejects an unavailable cookie source", () => {
  expect(() =>
    prepareYtDlpCookies([
      "--cookies",
      path.join(tmpdir(), "missing-pilzic-cookie", "cookies.txt"),
    ]),
  ).toThrow();
});
