export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(values.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await mapper(values[index], index),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(values.length, Math.max(1, concurrency));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
