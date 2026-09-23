import { audioJobScheduler } from "./AudioJobScheduler";
import { audioCacheManager } from "../managers/AudioCacheManager";
import { config } from "config";
import { monitorEventLoopDelay } from "node:perf_hooks";

class CoreMetrics {
  private readonly startupMs: number[] = [];
  private started = 0;
  private failed = 0;
  private cancelled = 0;
  private retries = 0;
  private readonly phases = new Map<string, number[]>();
  private readonly eventLoopLag = monitorEventLoopDelay({ resolution: 20 });

  constructor() {
    if (config.CORE_METRICS_INTERVAL_SECONDS > 0) {
      this.eventLoopLag.enable();
      const timer = setInterval(() => {
        console.info(
          JSON.stringify({ event: "core_metrics", ...this.snapshot() }),
        );
        this.eventLoopLag.reset();
      }, config.CORE_METRICS_INTERVAL_SECONDS * 1_000);
      timer.unref?.();
    }
  }

  public recordStartup(
    guildId: string,
    jobId: string,
    durationMs: number,
  ): void {
    this.started++;
    if (this.startupMs.length === 1_024) this.startupMs.shift();
    this.startupMs.push(durationMs);
    console.info(
      JSON.stringify({
        event: "audio_started",
        guildId,
        jobId,
        durationMs: Math.round(durationMs),
        jobs: audioJobScheduler.snapshot(),
      }),
    );
  }

  public recordFailure(guildId: string, jobId: string, error: unknown): void {
    this.failed++;
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/https?:\/\/\S+/gi, "[url]")
      .slice(0, 512);
    console.error(
      JSON.stringify({ event: "audio_failed", guildId, jobId, message }),
    );
  }

  public recordCancellation(): void {
    this.cancelled++;
  }

  public recordRetry(): void {
    this.retries++;
  }

  public recordPhase(phase: string, durationMs: number): void {
    const samples = this.phases.get(phase) ?? [];
    if (samples.length === 1_024) samples.shift();
    samples.push(durationMs);
    this.phases.set(phase, samples);
  }

  public snapshot(): object {
    const ordered = [...this.startupMs].sort((a, b) => a - b);
    const percentile = (p: number) =>
      ordered[Math.floor((ordered.length - 1) * p)] ?? null;
    const phaseP95Ms = Object.fromEntries(
      [...this.phases].map(([phase, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return [phase, sorted[Math.floor((sorted.length - 1) * 0.95)] ?? null];
      }),
    );
    return {
      started: this.started,
      failed: this.failed,
      cancelled: this.cancelled,
      retries: this.retries,
      startupP50Ms: percentile(0.5),
      startupP95Ms: percentile(0.95),
      phaseP95Ms,
      jobs: audioJobScheduler.snapshot(),
      cache: audioCacheManager.snapshot(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      eventLoopLagP95Ms: this.eventLoopLag.percentile(95) / 1_000_000,
    };
  }
}

export const coreMetrics = new CoreMetrics();
