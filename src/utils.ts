export function makeId(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  const id =
    cryptoApi && "randomUUID" in cryptoApi
      ? cryptoApi.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function clone<T>(value: T): T {
  return "structuredClone" in globalThis ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
