import { spawn } from "node:child_process";
import { copyFileSync, chmodSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getYtDlpPath } from "./YtDlpBinary";

export function prepareYtDlpCookies(args: string[]): {
  args: string[];
  cleanup: () => void;
} {
  const prepared = [...args];
  const directories: string[] = [];
  const cleanup = () => {
    for (const directory of directories)
      rmSync(directory, { recursive: true, force: true });
  };
  try {
    for (let index = 0; index < prepared.length; index++) {
      if (prepared[index] !== "--cookies" || !prepared[index + 1]) continue;
      const directory = mkdtempSync(path.join(tmpdir(), "pilzic-cookies-"));
      directories.push(directory);
      const cookiePath = path.join(directory, "cookies.txt");
      // yt-dlp saves its cookie jar at exit. Each process needs its own writable
      // copy, even when the supplied secret is mounted read-only in Docker.
      copyFileSync(prepared[index + 1], cookiePath);
      chmodSync(cookiePath, 0o600);
      prepared[++index] = cookiePath;
    }
    return { args: prepared, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function spawnYtDlp(args: string[]) {
  const cookies = prepareYtDlpCookies(args);
  try {
    const child = spawn(getYtDlpPath(), cookies.args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    // Wait until the process has stopped writing, including after cancellation
    // or a failed spawn, before deleting its private cookie jar.
    child.once("close", () => {
      try {
        cookies.cleanup();
      } catch {
        console.warn("Unable to remove temporary yt-dlp cookies.");
      }
    });
    return child;
  } catch (error) {
    cookies.cleanup();
    throw error;
  }
}
