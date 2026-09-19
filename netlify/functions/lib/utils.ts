/** Shared parsing / formatting helpers (mirrors the Python backend). */

export function utcNow(): string {
  return new Date().toISOString().replace("Z", "+00:00");
}

/** Parse server timestamps robustly (space- or T-separated, aware or naive UTC). */
export function parseUtc(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function loads(value: string | null | undefined, fallback: unknown): unknown {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function safeInt(
  value: unknown,
  field: string,
  fallbackValue?: number,
  minimum = 0,
  maximum = 1_000_000
): number {
  if (value === null || value === undefined || value === "") {
    if (fallbackValue !== undefined) return fallbackValue;
    throw new Error(`${field} is required.`);
  }
  if (typeof value === "boolean") throw new Error(`${field} must be a whole number.`);
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error(`${field} must be a whole number.`);
  if (number < minimum) throw new Error(`${field} must be at least ${minimum}.`);
  if (number > maximum) throw new Error(`${field} is too large.`);
  return number;
}