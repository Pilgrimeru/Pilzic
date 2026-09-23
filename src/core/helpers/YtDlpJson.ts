import { spawn } from "node:child_process";
import { audioJobScheduler } from "./AudioJobScheduler";
import { ensureYtDlpExists, getYtDlpPath } from "./YtDlpBinary";

export async function runYtDlpJson<T>(
  args: string[],
  signal?: AbortSignal,
): Promise<T> {
  await ensureYtDlpExists();
  const release = await audioJobScheduler.acquire(1, signal);
  try {
    return await new Promise<T>((resolve, reject) => {
      const child = spawn(getYtDlpPath(), args, {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const finish = (error?: Error, value?: T) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        if (error) {
          child.kill("SIGKILL");
          reject(error);
        } else resolve(value!);
      };
      const abort = () => finish(new Error("Metadata extraction cancelled"));
      const timer = setTimeout(
        () => finish(new Error("Metadata extraction timed out")),
        20_000,
      );
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > 8 * 1024 * 1024)
          finish(new Error("Metadata response is too large"));
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = (stderr + chunk.toString()).slice(-4_096);
      });
      child.once("error", (error) => finish(error));
      child.once("close", (code) => {
        if (code !== 0) {
          finish(
            new Error(`yt-dlp exited with code ${code}: ${stderr.trim()}`),
          );
          return;
        }
        try {
          finish(undefined, JSON.parse(stdout) as T);
        } catch (error) {
          finish(new Error("Invalid yt-dlp JSON", { cause: error }));
        }
      });
    });
  } finally {
    release();
  }
}
