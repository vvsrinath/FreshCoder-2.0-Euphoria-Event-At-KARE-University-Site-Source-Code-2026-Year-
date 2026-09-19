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
    handler: async () => ok({ status: "ok", env: "functions" }),
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
  // Netlify redirect rewrites /api/* → /.netlify/functions/api/:splat
  // Strip the function prefix so route patterns (/api/...) match correctly
  let path = event.path;
  if (path.startsWith("/.netlify/functions/api")) {
    path = path.replace("/.netlify/functions/api", "") || "/";
    if (!path.startsWith("/api/")) path = "/api" + path;
  }

  const response = await dispatchRequest(event.httpMethod, path, {
    headers: (event.headers as Record<string, string | undefined>) ?? {},
    rawBody: event.body ?? null,
    isBase64Encoded: event.isBase64Encoded ?? false,
    query: (event.queryStringParameters as Record<string, string | undefined>) ?? {},
  });
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: response.body,
  };
};