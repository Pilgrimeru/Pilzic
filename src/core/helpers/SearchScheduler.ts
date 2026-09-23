import { AudioJobScheduler } from "./AudioJobScheduler";
import { config } from "config";
import { coreMetrics } from "./CoreMetrics";

const scheduler = new AudioJobScheduler(config.SEARCH_CONCURRENCY);

export async function withSearchSlot<T>(work: () => Promise<T>): Promise<T> {
  const release = await scheduler.acquire();
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    coreMetrics.recordPhase("search", performance.now() - startedAt);
    release();
  }
}
