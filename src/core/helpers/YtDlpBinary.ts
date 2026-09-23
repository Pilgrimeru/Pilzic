import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import got from "got";

const VERSION = "2026.08.19";
const CHECKSUMS: Record<string, string> = {
  "yt-dlp.exe":
    "66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a",
  "yt-dlp_arm64.exe":
    "05b438997bafc3affdfda9d041353c9d73e04dc842207254b655b0887c4445b0",
  "yt-dlp_x86.exe":
    "a8f91bd41452506bc81ebd2f369b186fea0ee7075413ba00cef9fd346a0a5d0c",
  "yt-dlp_linux":
    "58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a",
  "yt-dlp_linux_aarch64":
    "b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc",
  "yt-dlp_macos":
    "0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202",
};
let initialization: Promise<void> | undefined;
let initialized = false;

export function getYtDlpPath(): string {
  const suffix =
    process.platform === "win32"
      ? process.arch === "arm64"
        ? "_arm64.exe"
        : process.arch === "ia32"
          ? "_x86.exe"
          : ".exe"
      : process.platform === "darwin"
        ? "_macos"
        : process.arch === "arm64"
          ? "_linux_aarch64"
          : process.arch === "arm"
            ? "_linux_armv7l"
            : "_linux";
  return path.resolve(process.cwd(), "scripts", `yt-dlp${suffix}`);
}

export function ensureYtDlpExists(): Promise<void> {
  if (initialized) return Promise.resolve();
  const target = getYtDlpPath();
  initialization ??= verifyOrDownload(target)
    .then(() => {
      initialized = true;
    })
    .finally(() => {
      initialization = undefined;
    });
  return initialization;
}

async function verifyOrDownload(target: string): Promise<void> {
  const expected = CHECKSUMS[path.basename(target)];
  if (!expected)
    throw new Error(
      `No verified yt-dlp binary for ${process.platform}/${process.arch}`,
    );
  if (existsSync(target)) {
    const actual = await hashFile(target);
    if (actual === expected) return;
    await rm(target, { force: true });
  }
  await download(target);
}

async function download(target: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const assetName = path.basename(target);
  const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${VERSION}`;
  const expected = CHECKSUMS[assetName];
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    await pipeline(
      got.stream(`${base}/${assetName}`, {
        timeout: { request: 30_000 },
        retry: { limit: 2 },
      }),
      createWriteStream(temporary),
    );
    const actual = await hashFile(temporary);
    if (actual !== expected) throw new Error("yt-dlp checksum mismatch");
    if (process.platform !== "win32") await chmod(temporary, 0o755);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
