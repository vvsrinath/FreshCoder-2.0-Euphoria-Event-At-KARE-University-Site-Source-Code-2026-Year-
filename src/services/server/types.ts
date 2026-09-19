import type { Role, User } from '../../types';

export interface Ctx {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  user: (User & {passwordHash: string;}) | null;
  token: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Handler = (ctx: Ctx) => any;

export class HttpError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requireUser(ctx: Ctx) {
  if (!ctx.user) throw new HttpError(401, 'Your session has expired. Please sign in again.');
  if (!ctx.user.active) throw new HttpError(403, 'This account has been deactivated.');
  return ctx.user;
}

export function requireRole(ctx: Ctx, ...roles: Role[]) {
  const user = requireUser(ctx);
  if (!roles.includes(user.role)) {
    throw new HttpError(403, 'You do not have permission to perform this action.');
  }
  return user;
}