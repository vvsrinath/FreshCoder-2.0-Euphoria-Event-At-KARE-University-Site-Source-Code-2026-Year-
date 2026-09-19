import { db } from '../db';
import { adminRoutes } from './adminRoutes';
import { authRoutes } from './authRoutes';
import { staffRoutes } from './staffRoutes';
import { studentRoutes } from './studentRoutes';
import { HttpError, type Ctx, type Handler } from './types';

/**
 * Local implementation of the Flask REST API. Every rule the real backend
 * enforces — authentication, authorization, deadlines, attempt state — is
 * enforced here too, so the client can never be the authority.
 */
const routes: Record<string, Handler> = {
  ...authRoutes,
  ...studentRoutes,
  ...staffRoutes,
  ...adminRoutes
};

interface Matched {
  handler: Handler;
  params: Record<string, string>;
}

function matchRoute(method: string, path: string): Matched | null {
  const target = path.split('/').filter(Boolean);
  for (const key of Object.keys(routes)) {
    const [routeMethod, routePath] = key.split(' ');
    if (routeMethod !== method) continue;
    const parts = routePath.split('/').filter(Boolean);
    if (parts.length !== target.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i].startsWith(':')) params[parts[i].slice(1)] = decodeURIComponent(target[i]);else
      if (parts[i] !== target[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: routes[key], params };
  }
  return null;
}

const LATENCY_MS = 120;

export interface LocalResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export async function localRequest(
method: string,
url: string,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
body: any,
token: string | null)
: Promise<LocalResponse> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const [path, queryString] = url.split('?');
  const query: Record<string, string> = {};
  new URLSearchParams(queryString ?? '').forEach((value, key) => {
    if (value) query[key] = value;
  });

  const matched = matchRoute(method, path);
  if (!matched) return { status: 404, data: { message: `No route for ${method} ${path}` } };

  const session = token ? db.sessions.find((s) => s.token === token) : null;
  const user = session ? db.users.find((u) => u.id === session.userId) ?? null : null;

  const ctx: Ctx = { method, path, params: matched.params, query, body, user, token };
  try {
    const data = matched.handler(ctx);
    return { status: 200, data };
  } catch (error) {
    if (error instanceof HttpError) {
      return { status: error.status, data: { message: error.message, code: error.code } };
    }
    return {
      status: 500,
      data: { message: (error as Error).message || 'Unexpected server error.' }
    };
  }
}