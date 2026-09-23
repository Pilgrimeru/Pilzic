/** Limits expensive audio jobs across every guild. Playback takes precedence over preloads. */
import { config } from "config";

export class AudioJobScheduler {
  private active = 0;
  private peak = 0;
  private cancelled = 0;
  private readonly waiting: Array<{
    priority: number;
    resolve: (release: () => void) => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    abort: () => void;
  }> = [];

  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  public acquire(priority = 0, signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const entry = {
        priority,
        resolve,
        reject,
        signal,
        abort: () => {
          const index = this.waiting.indexOf(entry);
          if (index >= 0) this.waiting.splice(index, 1);
          this.cancelled++;
          reject(signal?.reason ?? new Error("Audio job cancelled"));
        },
      };
      signal?.addEventListener("abort", entry.abort, { once: true });
      this.waiting.push(entry);
      this.waiting.sort((a, b) => b.priority - a.priority);
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.capacity && this.waiting.length) {
      const job = this.waiting.shift()!;
      job.signal?.removeEventListener("abort", job.abort);
      if (job.signal?.aborted) {
        job.reject(job.signal.reason);
        continue;
      }
      this.active++;
      this.peak = Math.max(this.peak, this.active);
      let released = false;
      job.resolve(() => {
        if (released) return;
        released = true;
        this.active--;
        this.drain();
      });
    }
  }

  public snapshot(): {
    capacity: number;
    active: number;
    queued: number;
    peak: number;
    cancelled: number;
  } {
    return {
      capacity: this.capacity,
      active: this.active,
      queued: this.waiting.length,
      peak: this.peak,
      cancelled: this.cancelled,
    };
  }
}

export const audioJobScheduler = new AudioJobScheduler(
  config.AUDIO_JOB_CONCURRENCY,
);
