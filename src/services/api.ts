import { localRequest } from './server';

/**
 * Single API client. Point VITE_API_BASE_URL at the Flask server
 * (e.g. http://localhost:5000) and every call below hits the real backend
 * instead of the bundled local implementation — the contract is identical.
 */
const BASE_URL =
typeof import.meta !== 'undefined' &&
(import.meta as unknown as {env?: Record<string, string>;}).env?.VITE_API_BASE_URL ||
'';

const TOKEN_KEY = 'fc_session_token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);else
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {

    /* storage unavailable */}
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiRequestError';
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getToken();

  if (BASE_URL) {
    const response = await fetch(`${BASE_URL}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiRequestError(response.status, data.message || 'Request failed.');
    }
    return data as T;
  }

  const { status, data } = await localRequest(method, url, body, token);
  if (status >= 400) throw new ApiRequestError(status, data?.message ?? 'Request failed.');
  return data as T;
}

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`;
}

export const api = {
  // ---- auth ----
  login: (userId: string, password: string, portal: string) =>
  request<{token: string;user: {id: string;role: string;name: string;email: string;};}>(
    'POST',
    '/api/auth/login',
    { userId, password, portal }
  ),
  logout: () => request<{ok: boolean;}>('POST', '/api/auth/logout'),
  me: () => request<{user: {id: string;role: string;name: string;email: string;};}>('GET', '/api/auth/me'),
  reportEvent: (type: string, detail: string, attemptId?: string) =>
  request<{ok: boolean;}>('POST', '/api/auth/security-event', { type, detail, attemptId }),

  // ---- student ----
  studentDashboard: () => request<any>('GET', '/api/student/dashboard'),
  studentTest: (id: string) => request<any>('GET', `/api/student/tests/${id}`),
  startTest: (id: string) => request<any>('POST', `/api/student/tests/${id}/start`),
  getAttempt: (id: string) => request<any>('GET', `/api/student/attempts/${id}`),
  lockAnswer: (attemptId: string, questionId: string, value: string) =>
  request<any>('POST', `/api/student/attempts/${attemptId}/lock`, { questionId, value }),
  heartbeat: (attemptId: string, currentQuestion: number, answeredCount: number) =>
  request<any>('POST', `/api/student/attempts/${attemptId}/heartbeat`, {
    currentQuestion,
    answeredCount
  }),
  submitAttempt: (attemptId: string, answers: Record<string, string>, reason: string) =>
  request<any>('POST', `/api/student/attempts/${attemptId}/submit`, { answers, reason }),
  requestEdit: (attemptId: string, questionId: string, reason: string) =>
  request<any>('POST', `/api/student/attempts/${attemptId}/edit-request`, { questionId, reason }),
  studentResults: () => request<any>('GET', '/api/student/results'),

  // ---- staff ----
  staffDashboard: () => request<any>('GET', '/api/staff/dashboard'),
  tests: () => request<any>('GET', '/api/staff/tests'),
  test: (id: string) => request<any>('GET', `/api/staff/tests/${id}`),
  createTest: (payload: unknown) => request<any>('POST', '/api/staff/tests', payload),
  updateTest: (id: string, payload: unknown) => request<any>('PUT', `/api/staff/tests/${id}`, payload),
  duplicateTest: (id: string) => request<any>('POST', `/api/staff/tests/${id}/duplicate`),
  scheduleTest: (id: string, scheduledStart: string) =>
  request<any>('POST', `/api/staff/tests/${id}/schedule`, { scheduledStart }),
  startTestAsStaff: (id: string) => request<any>('POST', `/api/staff/tests/${id}/start`),
  stopTest: (id: string) => request<any>('POST', `/api/staff/tests/${id}/stop`),
  forceStopTest: (id: string) => request<any>('POST', `/api/staff/tests/${id}/force-stop`),
  deleteTest: (id: string) => request<any>('DELETE', `/api/staff/tests/${id}`),
  timingChanges: (id: string) => request<any>('GET', `/api/staff/tests/${id}/timing-changes`),

  // ---- questions ----
  questions: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/questions${qs(filters)}`),
  createQuestion: (payload: unknown) => request<any>('POST', '/api/questions', payload),
  question: (id: string) => request<any>('GET', `/api/questions/${id}`),
  updateQuestion: (id: string, payload: unknown) => request<any>('PUT', `/api/questions/${id}`, payload),
  archiveQuestion: (id: string) => request<any>('DELETE', `/api/questions/${id}`),
  duplicateQuestion: (id: string) => request<any>('POST', `/api/questions/${id}/duplicate`),

  // ---- monitoring ----
  live: () => request<any>('GET', '/api/staff/live'),
  lockStudent: (id: string, reason: string) =>
  request<any>('POST', `/api/staff/students/${id}/lock`, { reason }),
  unlockStudent: (id: string, reason: string) =>
  request<any>('POST', `/api/staff/students/${id}/unlock`, { reason }),
  forceSubmitStudent: (id: string) => request<any>('POST', `/api/staff/students/${id}/force-submit`),

  // ---- edit requests ----
  editRequests: () => request<any>('GET', '/api/staff/edit-requests'),
  approveEditRequest: (id: string) => request<any>('POST', `/api/staff/edit-requests/${id}/approve`),
  denyEditRequest: (id: string) => request<any>('POST', `/api/staff/edit-requests/${id}/deny`),

  // ---- results ----
  results: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/results${qs(filters)}`),
  result: (id: string) => request<any>('GET', `/api/results/${id}`),
  publishResults: (testId: string, published: boolean) =>
  request<any>('POST', '/api/results/publish', { testId, published }),

  // ---- logs ----
  securityEvents: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/staff/security-events${qs(filters)}`),
  auditLogs: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/staff/audit-logs${qs(filters)}`),

  // ---- admin ----
  adminOverview: () => request<any>('GET', '/api/admin/overview'),
  students: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/admin/students${qs(filters)}`),
  createStudent: (payload: unknown) => request<any>('POST', '/api/admin/students', payload),
  updateStudent: (id: string, payload: unknown) => request<any>('PUT', `/api/admin/students/${id}`, payload),
  importStudents: (rows: Record<string, string>[]) =>
  request<any>('POST', '/api/admin/students/import', { rows }),
  staffAccounts: (filters: Record<string, string | undefined> = {}) =>
  request<any>('GET', `/api/admin/staff${qs(filters)}`),
  createStaff: (payload: unknown) => request<any>('POST', '/api/admin/staff', payload),
  updateStaff: (id: string, payload: unknown) => request<any>('PUT', `/api/admin/staff/${id}`, payload),
  events: () => request<any>('GET', '/api/admin/events'),
  createEvent: (payload: unknown) => request<any>('POST', '/api/admin/events', payload),
  updateEvent: (id: string, payload: unknown) => request<any>('PUT', `/api/admin/events/${id}`, payload)
};