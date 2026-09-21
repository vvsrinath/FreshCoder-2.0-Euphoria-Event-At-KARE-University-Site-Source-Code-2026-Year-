/** Netlify Function entry point. Lazy imports to avoid 502 on cold start. */
import type { Handler } from "@netlify/functions";

export const config = { path: "/api/*" };

export const handler: Handler = async (event) => {
  try {
    const { run } = await import("./lib/router");
    const { ok } = await import("./lib/http");
    const { authRoutes } = await import("./lib/routes/auth");
    const { studentRoutes } = await import("./lib/routes/student");
    const { staffRoutes } = await import("./lib/routes/staff");
    const { adminRoutes } = await import("./lib/routes/admin");

    const routes = [
      {
        method: "GET",
        pattern: /^\/api\/health$/,
        roles: [] as string[],
        handler: async () => {
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

    let path = event.path;
    if (path.startsWith("/.netlify/functions/api")) {
      path = path.replace("/.netlify/functions/api", "") || "/";
      if (!path.startsWith("/")) path = "/" + path;
      if (!path.startsWith("/api")) path = "/api" + path;
    }

    const response = await run(
      {
        method: event.httpMethod,
        path: path.split("?")[0],
        headers: (event.headers as Record<string, string | undefined>) ?? {},
        rawBody: event.body ?? null,
        isBase64Encoded: event.isBase64Encoded ?? false,
        query: (event.queryStringParameters as Record<string, string | undefined>) ?? {},
      },
      routes
    );
    return {
      statusCode: response.statusCode,
      headers: {
        "Content-Type": "application/json",
        ...response.headers,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      },
      body: response.body,
    };
  } catch (err) {
    console.error("[api] Fatal:", err, (err as Error).stack);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ message: `Server error: ${(err as Error).message}`, stack: String((err as Error).stack || "").slice(0, 600) }),
    };
  }
};

/** For local smoke tests */
export async function dispatchRequest(method: string, absolutePath: string, envelope: Partial<import("./lib/router").RequestEnvelope> = {}) {
  const { run } = await import("./lib/router");
  const { ok } = await import("./lib/http");
  const { authRoutes } = await import("./lib/routes/auth");
  const { studentRoutes } = await import("./lib/routes/student");
  const { staffRoutes } = await import("./lib/routes/staff");
  const { adminRoutes } = await import("./lib/routes/admin");
  const routes = [
    { method: "GET", pattern: /^\/api\/health$/, roles: [] as string[], handler: async () => ok({ status: "ok", env: "functions" }) },
    ...authRoutes, ...studentRoutes, ...staffRoutes, ...adminRoutes,
  ];
  return run(
    {
      method,
      path: absolutePath.split("?")[0],
      headers: envelope.headers ?? {},
      rawBody: envelope.rawBody ?? null,
      isBase64Encoded: envelope.isBase64Encoded ?? false,
      query: envelope.query ?? {},
    },
    routes
  );
}
