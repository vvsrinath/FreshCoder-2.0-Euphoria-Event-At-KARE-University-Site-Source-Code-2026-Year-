import { audit, db, hashPassword, now, security, uid, verifyPassword } from '../db';
import type { Role } from '../../types';
import { HttpError, requireUser, type Handler } from './types';

const portalRoles: Record<string, Role[]> = {
  STUDENT: ['STUDENT'],
  STAFF: ['STAFF'],
  ADMIN: ['SUPER_ADMIN', 'DEVELOPER']
};

function publicUser(u: {id: string;role: Role;name: string;email: string;active: boolean;}) {
  return { id: u.id, role: u.role, name: u.name, email: u.email, active: u.active };
}

export const authRoutes: Record<string, Handler> = {
  'POST /api/auth/login': (ctx) => {
    const { userId, password, portal } = ctx.body ?? {};
    if (!userId || !password) {
      throw new HttpError(400, 'Enter your ID and password to continue.');
    }
    const user = db.users.find((u) => u.id.toUpperCase() === String(userId).toUpperCase());
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      security('LOGIN_FAILURE', String(userId), 'SYSTEM', `Failed login attempt on ${portal} portal`);
      throw new HttpError(401, 'Invalid credentials. Please check your ID and password.');
    }
    if (!user.active) {
      security('LOGIN_FAILURE', user.id, user.role, 'Login attempt on a deactivated account');
      throw new HttpError(403, 'This account has been deactivated. Contact examination staff.');
    }
    const allowed = portalRoles[portal as string] ?? [];
    if (portal && !allowed.includes(user.role)) {
      security('LOGIN_FAILURE', user.id, user.role, `Wrong portal used (${portal})`);
      throw new HttpError(403, 'This account cannot sign in from this portal.');
    }

    const existing = db.sessions.filter((s) => s.userId === user.id);
    if (existing.length > 0) {
      security(
        'MULTIPLE_SESSION_DETECTED',
        user.id,
        user.role,
        'A second session was opened while another was already active'
      );
    }
    const token = uid('SESS');
    db.sessions.push({ token, userId: user.id, role: user.role, createdAt: now() });
    security('LOGIN_SUCCESS', user.id, user.role, `Signed in via ${portal ?? 'portal'}`);
    security('SESSION_STARTED', user.id, user.role, `Session ${token} started`);
    return { token, user: publicUser(user) };
  },

  'POST /api/auth/logout': (ctx) => {
    if (ctx.token) {
      const idx = db.sessions.findIndex((s) => s.token === ctx.token);
      if (idx >= 0) db.sessions.splice(idx, 1);
    }
    if (ctx.user) security('SESSION_ENDED', ctx.user.id, ctx.user.role, 'Signed out');
    return { ok: true };
  },

  'GET /api/auth/me': (ctx) => ({ user: publicUser(requireUser(ctx)) }),

  'POST /api/auth/change-password': (ctx) => {
    const user = requireUser(ctx);
    const { currentPassword, newPassword } = ctx.body ?? {};
    const current = currentPassword || '';
    const next = newPassword || '';
    if (next.length < 8) throw new HttpError(400, 'Password must be at least 8 characters long.');
    const record = db.users.find((u) => u.id === user.id);
    if (!record) throw new HttpError(404, 'Account not found.');
    if (!verifyPassword(current, record.passwordHash)) {
      security('PASSWORD_CHANGE_FAILED', user.id, user.role, 'Wrong current password');
      throw new HttpError(400, 'Your current password is incorrect.');
    }
    if (verifyPassword(next, record.passwordHash)) {
      throw new HttpError(400, 'New password must be different.');
    }
    record.passwordHash = hashPassword(next);
    security('PASSWORD_CHANGED', user.id, user.role, 'Password changed');
    audit(user.id, user.role, 'Changed password', user.id, '');
    return { ok: true };
  },

  'POST /api/auth/security-event': (ctx) => {
    const user = requireUser(ctx);
    const { type, detail, attemptId } = ctx.body ?? {};
    const allowed = [
    'FULLSCREEN_EXIT',
    'TAB_VISIBILITY_CHANGE',
    'NAVIGATION_ATTEMPT',
    'CONTEXT_MENU_BLOCKED',
    'COPY_BLOCKED'];

    if (!allowed.includes(type)) throw new HttpError(400, 'Unknown monitoring signal.');
    security(type, user.id, user.role, String(detail ?? ''), { attemptId });
    return { ok: true };
  },

  /** Developer bootstrap: initialise the first Super Admin. */
  'POST /api/developer/init-super-admin': (ctx) => {
    const user = requireUser(ctx);
    if (user.role !== 'DEVELOPER') {
      throw new HttpError(403, 'Only the developer account can initialise a Super Admin.');
    }
    const { id, name, email, password } = ctx.body ?? {};
    if (!id || !name || !password) throw new HttpError(400, 'ID, name and password are required.');
    if (db.users.some((u) => u.id === id)) throw new HttpError(409, 'That ID already exists.');
    db.users.push({
      id: String(id).toUpperCase(),
      role: 'SUPER_ADMIN',
      name: String(name),
      email: String(email ?? ''),
      active: true,
      createdAt: now(),
      passwordHash: hashPassword(String(password))
    });
    audit(user.id, user.role, 'Initialised Super Admin', String(id), String(email ?? ''));
    return { ok: true };
  }
};