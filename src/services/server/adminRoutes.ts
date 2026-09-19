import type { EventRecord, Role } from '../../types';
import { audit, db, hashPassword, now, uid } from '../db';
import { HttpError, requireRole, type Ctx, type Handler } from './types';

function listUsers(role: Role, query: Record<string, string>) {
  const { search, status } = query;
  let list = db.users.
  filter((u) => u.role === role).
  map((u) => ({ id: u.id, name: u.name, email: u.email, active: u.active, createdAt: u.createdAt }));
  if (status === 'ACTIVE') list = list.filter((u) => u.active);
  if (status === 'INACTIVE') list = list.filter((u) => !u.active);
  if (search) {
    const s = search.toLowerCase();
    list = list.filter((u) => u.id.toLowerCase().includes(s) || u.name.toLowerCase().includes(s));
  }
  return list;
}

function createUser(ctx: Ctx, role: Role) {
  const admin = requireRole(ctx, 'SUPER_ADMIN');
  const { id, name, email, password } = ctx.body ?? {};
  if (!id?.trim() || !name?.trim() || !password?.trim()) {
    throw new HttpError(400, 'ID, name and password are required.');
  }
  if (db.users.some((u) => u.id.toUpperCase() === String(id).toUpperCase())) {
    throw new HttpError(409, `${id} already exists.`);
  }
  const user = {
    id: String(id).trim().toUpperCase(),
    role,
    name: String(name).trim(),
    email: String(email ?? '').trim(),
    active: true,
    createdAt: now(),
    passwordHash: hashPassword(String(password))
  };
  db.users.push(user);
  audit(admin.id, admin.role, role === 'STUDENT' ? 'Created student' : 'Created staff', user.id, user.name);
  return { id: user.id, name: user.name, email: user.email, active: user.active, createdAt: user.createdAt };
}

function updateUser(ctx: Ctx, role: Role) {
  const admin = requireRole(ctx, 'SUPER_ADMIN');
  const user = db.users.find((u) => u.id === ctx.params.id && u.role === role);
  if (!user) throw new HttpError(404, 'Account not found.');
  const body = ctx.body ?? {};
  if (body.password) {
    user.passwordHash = hashPassword(String(body.password));
    audit(admin.id, admin.role, 'Reset password', user.id, '');
  }
  if (typeof body.active === 'boolean' && body.active !== user.active) {
    user.active = body.active;
    audit(admin.id, admin.role, body.active ? 'Activated account' : 'Deactivated account', user.id, '');
  }
  if (body.name) user.name = String(body.name);
  if (body.email !== undefined) user.email = String(body.email);
  if (body.name || body.email !== undefined) {
    audit(admin.id, admin.role, 'Edited account', user.id, user.name);
  }
  return { id: user.id, name: user.name, email: user.email, active: user.active, createdAt: user.createdAt };
}

export const adminRoutes: Record<string, Handler> = {
  'GET /api/admin/overview': (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN');
    return {
      stats: {
        students: db.users.filter((u) => u.role === 'STUDENT').length,
        activeStudents: db.users.filter((u) => u.role === 'STUDENT' && u.active).length,
        staff: db.users.filter((u) => u.role === 'STAFF').length,
        events: db.events.length,
        tests: db.tests.length,
        questions: db.questions.filter((q) => q.status === 'ACTIVE').length,
        results: db.results.length
      },
      recentAudit: db.auditLogs.slice(0, 8),
      securityEvents: db.securityEvents.slice(0, 6)
    };
  },

  'GET /api/admin/students': (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN');
    return { students: listUsers('STUDENT', ctx.query) };
  },
  'POST /api/admin/students': (ctx) => ({ student: createUser(ctx, 'STUDENT') }),
  'PUT /api/admin/students/:id': (ctx) => ({ student: updateUser(ctx, 'STUDENT') }),

  'POST /api/admin/students/import': (ctx) => {
    const admin = requireRole(ctx, 'SUPER_ADMIN');
    const rows = (ctx.body?.rows ?? []) as Record<string, string>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new HttpError(400, 'The uploaded file contains no rows.');
    }
    const errors: {row: number;message: string;}[] = [];
    let success = 0;
    rows.forEach((row, index) => {
      const id = (row.student_id ?? '').trim().toUpperCase();
      const name = (row.name ?? '').trim();
      const email = (row.email ?? '').trim();
      const password = (row.password ?? '').trim();
      if (!id || !name || !password) {
        errors.push({ row: index + 2, message: 'Missing student_id, name or password' });
        return;
      }
      if (db.users.some((u) => u.id === id)) {
        errors.push({ row: index + 2, message: `Duplicate ID ${id}` });
        return;
      }
      db.users.push({
        id,
        role: 'STUDENT',
        name,
        email,
        active: true,
        createdAt: now(),
        passwordHash: hashPassword(password)
      });
      success += 1;
    });
    audit(admin.id, admin.role, 'Imported students', `${rows.length} rows`, `${success} imported, ${errors.length} failed`);
    return { total: rows.length, success, failed: errors.length, errors };
  },

  'GET /api/admin/staff': (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN');
    return { staff: listUsers('STAFF', ctx.query) };
  },
  'POST /api/admin/staff': (ctx) => ({ staff: createUser(ctx, 'STAFF') }),
  'PUT /api/admin/staff/:id': (ctx) => ({ staff: updateUser(ctx, 'STAFF') }),

  'GET /api/admin/events': (ctx) => {
    requireRole(ctx, 'SUPER_ADMIN', 'STAFF');
    return {
      events: db.events.map((e) => ({
        ...e,
        testCount: db.tests.filter((t) => t.eventId === e.id).length
      }))
    };
  },

  'POST /api/admin/events': (ctx) => {
    const admin = requireRole(ctx, 'SUPER_ADMIN');
    const body = ctx.body ?? {};
    if (!body.name?.trim()) throw new HttpError(400, 'Event name is required.');
    const event: EventRecord = {
      id: uid('EV'),
      name: body.name.trim(),
      description: body.description ?? '',
      department: body.department ?? 'Department of Freshman Engineering',
      startDate: body.startDate ?? '',
      endDate: body.endDate ?? '',
      venue: body.venue ?? '',
      status: body.status ?? 'DRAFT',
      registrationSite: body.registrationSite ?? '',
      registrationFee: body.registrationFee ?? '',
      prizePool: body.prizePool ?? ''
    };
    db.events.push(event);
    audit(admin.id, admin.role, 'Created event', event.name, event.startDate);
    return { event };
  },

  'PUT /api/admin/events/:id': (ctx) => {
    const admin = requireRole(ctx, 'SUPER_ADMIN');
    const event = db.events.find((e) => e.id === ctx.params.id);
    if (!event) throw new HttpError(404, 'Event not found.');
    Object.assign(event, ctx.body, { id: event.id });
    audit(admin.id, admin.role, 'Updated event', event.name, '');
    return { event };
  }
};