/** Route definition and dispatch shared by every handler module. */
import { ApiError, HttpResponse, errorResponse, parseBody } from "./http";
import { requireAuth, currentUser, type AuthUser } from "./auth";

export interface RouteCtx {
  params: string[];
  query: Record<string, string | undefined>;
  body: Record<string, unknown>;
  user: AuthUser;
  token: string | null;
  ip: string;
}

export interface RouteDef {
  method: string;
  pattern: RegExp;
  /** null = any signed-in user; [] = public; otherwise the allowed roles. */
  roles: string[] | null;
  handler: (ctx: RouteCtx) => Promise<HttpResponse>;
}

export interface RequestEnvelope {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  rawBody: string | null;
  isBase64Encoded: boolean;
  query: Record<string, string | undefined>;
}

export async function dispatch(envelope: RequestEnvelope, routes: RouteDef[]): Promise<HttpResponse> {
  const authHeader = envelope.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const ip =
    envelope.headers["x-nf-client-connection-ip"] ||
    envelope.headers["x-forwarded-for"] ||
    envelope.headers["client-ip"] ||
    "local";

  for (const def of routes) {
    if (def.method !== envelope.method) continue;
    const match = def.pattern.exec(envelope.path);
    if (match === null) continue;
    const params = match.slice(1);

    let body: Record<string, unknown>;
    try {
      body = parseBody<Record<string, unknown>>(envelope.rawBody, envelope.isBase64Encoded);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      body = {};
    }

    const ctx: RouteCtx = {
      params,
      query: envelope.query,
      body,
      user: undefined as unknown as AuthUser,
      token,
      ip,
    };

    if (def.roles === null) {
      const auth = await requireAuth(token, undefined);
      ctx.user = auth.user;
      ctx.token = auth.token;
    } else if (def.roles.length > 0) {
      const auth = await requireAuth(token, def.roles);
      ctx.user = auth.user;
      ctx.token = auth.token;
    } else if (token) {
      const auth = await currentUser(token);
      if (auth) {
        ctx.user = auth.user;
        ctx.token = auth.token;
      }
    }

    return await def.handler(ctx);
  }
  throw new ApiError(404, "Resource not found.");
}

export async function run(envelope: RequestEnvelope, routes: RouteDef[]): Promise<HttpResponse> {
  try {
    return await dispatch(envelope, routes);
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof Error && error.message.includes("TURSO_DB_URL")) {
      return errorResponse("Unexpected server error.", 500);
    }
    return errorResponse("Unexpected server error.", 500);
  }
}