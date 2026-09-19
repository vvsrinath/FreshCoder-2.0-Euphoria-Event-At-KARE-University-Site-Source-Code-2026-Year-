/** Netlify Function entry point. Single catch-all for every /api/* request. */
import type { Handler } from "@netlify/functions";
import { run, type RequestEnvelope, type RouteDef } from "./lib/router";
import { ok } from "./lib/http";
import { authRoutes } from "./lib/routes/auth";
import { studentRoutes } from "./lib/routes/student";
import { staffRoutes } from "./lib/routes/staff";
import { adminRoutes } from "./lib/routes/admin";

export const config = { path: "/api/*" };

const routes: RouteDef[] = [
  {
    method: "GET",
    pattern: /^\/api\/health$/,
    roles: [],
    handler: async () => {
      // Diagnostic: check if Turso env vars are available (no values exposed)
      const { config } = await import("./lib/config");
      return ok({
        status: "ok",
        env: "functions",
        tursoUrlSet: !!config.tursoDbUrl,
        tursoTokenSet: !!config.tursoAuthToken,
        tursoUrlPrefix: config.tursoDbUrl ? config.tursoDbUrl.slice(0, 20) + "..." : "MISSING",
      });
    },
  },
  ...authRoutes,
  ...studentRoutes,
  ...staffRoutes,
  ...adminRoutes,
];

/** Pure entry used by the bundler and by local smoke tests. */
export async function dispatchRequest(method: string, absolutePath: string, envelope: Partial<RequestEnvelope> = {}) {
  const path = absolutePath.split("?")[0];
  const fullEnvelope: RequestEnvelope = {
    method,
    path,
    headers: envelope.headers ?? {},
    rawBody: envelope.rawBody ?? null,
    isBase64Encoded: envelope.isBase64Encoded ?? false,
    query: envelope.query ?? {},
  };
  return run(fullEnvelope, routes);
}

export const handler: Handler = async (event) => {
  // Direct call via /.netlify/functions/api/*  →  normalize to /api/* for router
  // Also handles /api/* via config.path
  let path = event.path;
  if (path.startsWith("/.netlify/functions/api")) {
    path = path.replace("/.netlify/functions/api", "") || "/";
    if (!path.startsWith("/api/") && !path.startsWith("/")) path = "/" + path;
    if (!path.startsWith("/api")) path = "/api" + path;
  }
  // Strip query string for logging
  const logPath = path.split("?")[0];

  try {
    const response = await dispatchRequest(event.httpMethod, path, {
      headers: (event.headers as Record<string, string | undefined>) ?? {},
      rawBody: event.body ?? null,
      isBase64Encoded: event.isBase64Encoded ?? false,
      query: (event.queryStringParameters as Record<string, string | undefined>) ?? {},
    });
    return {
      statusCode: response.statusCode,
      headers: { ...response.headers, "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
      body: response.body,
    };
  } catch (err) {
    console.error(`[api] Unhandled error for ${event.httpMethod} ${logPath}:`, err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: `Server error: ${(err as Error).message}` }),
    };
  }
};