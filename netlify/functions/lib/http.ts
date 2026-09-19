/** Minimal HTTP helpers for Netlify function responses. */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function ok(data: unknown, status = 200): HttpResponse {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export function csvResponse(text: string, filename: string): HttpResponse {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
    body: text,
  };
}

export function errorResponse(message: string, status: number): HttpResponse {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) };
}

export function parseBody<T = Record<string, unknown>>(raw: string | null | undefined, isBase64 = false): T {
  if (!raw) return {} as T;
  const text = isBase64 ? Buffer.from(raw, "base64").toString("utf-8") : raw;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

/** CSV writer matching Python's csv module (QUOTE_MINIMAL, RFC 4180). */
export function csv(texts: unknown[]): string {
  return texts
    .map((t) => {
      const field = t === null || t === undefined ? "" : String(t);
      if (/[",\n\r]/.test(field)) return `"${field.replace(/"/g, '""')}"`;
      return field;
    })
    .join(",");
}