export function observe<T>(promise: Promise<T>, label: string): void {
  void promise.catch((error) => console.error(`[${label}]`, error));
}
