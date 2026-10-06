const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const SESSION_KEY = 'septlion_session';
const SIGN_IN_REQUIRED = 'انتهت جلسة الدخول. سجل الدخول مجددًا للمتابعة.';
const SESSION_CHANGED = 'تغيرت جلسة الدخول. أعد المحاولة من الحساب الحالي.';

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string; email?: string };
};
type StoredSession = Session & { session_key: string };
let refreshing: { key: string; promise: Promise<string> } | null = null;

const headers = (token?: string) => ({
  'Content-Type': 'application/json', apikey: SUPABASE_KEY,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
function configured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('إعدادات تسجيل الدخول غير متاحة. حاول لاحقًا.');
}
function tokenExpiry(token: string): number | undefined {
  // Expiry is only a refresh hint; Supabase validates the JWT on every request.
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : undefined;
  } catch { return undefined; }
}
function readSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
    if (saved && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string' && typeof saved.session_key === 'string') return saved;
  } catch { /* Read older clients' keys below. */ }
  const access_token = storage.getItem('septlion_access') || '';
  const refresh_token = storage.getItem('septlion_refresh') || '';
  return access_token || refresh_token
    ? { access_token, refresh_token, expires_at: tokenExpiry(access_token), session_key: `legacy:${access_token || refresh_token}` }
    : null;
}
function storeSession(s: Session, key: string) {
  if (!s?.access_token || !s?.refresh_token) throw new Error('تعذر قراءة جلسة الدخول. حاول مجددًا.');
  const expires_at = s.expires_at ?? tokenExpiry(s.access_token)
    ?? (s.expires_in ? Math.floor(Date.now() / 1000) + s.expires_in : undefined);
  const saved: StoredSession = { ...s, expires_at, session_key: key };
  // One atomic record keeps the token pair consistent between tabs. Mirror the
  // previous keys so already-open clients survive the deployment.
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  window.localStorage.setItem('septlion_access', s.access_token);
  window.localStorage.setItem('septlion_refresh', s.refresh_token);
}
function needsRefresh(s: StoredSession) {
  const expiry = s.expires_at ?? tokenExpiry(s.access_token);
  return !s.access_token || (expiry !== undefined && expiry <= Math.floor(Date.now() / 1000) + 60);
}
function currentSession(expectedKey: string): StoredSession {
  const current = readSession();
  if (!current) throw new Error(SIGN_IN_REQUIRED);
  if (current.session_key !== expectedKey) throw new Error(SESSION_CHANGED);
  return current;
}
function unchanged(s: StoredSession) {
  const current = readSession();
  return current?.session_key === s.session_key && current.access_token === s.access_token && current.refresh_token === s.refresh_token;
}
function clearRejected(s: StoredSession) { if (unchanged(s)) clearSession(); }
async function responseBody(r: Response): Promise<any> { return r.json().catch(() => null); }
function message(b: any, fallback: string) { return b?.error_description || b?.msg || b?.message || b?.error || fallback; }

async function refreshSession(expected: StoredSession, rejectedToken?: string): Promise<string> {
  if (refreshing?.key === expected.session_key) return refreshing.promise;
  const run = async () => {
    const current = currentSession(expected.session_key);
    if (!needsRefresh(current) && (!rejectedToken || current.access_token !== rejectedToken)) return current.access_token;
    if (!current.refresh_token) { clearRejected(current); throw new Error(SIGN_IN_REQUIRED); }
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    const b = await responseBody(r);
    // A late response must not undo logout or overwrite a newer sign-in.
    if (!unchanged(current)) throw new Error(SESSION_CHANGED);
    if (!r.ok) {
      if ([400, 401, 403].includes(r.status)) { clearRejected(current); throw new Error(SIGN_IN_REQUIRED); }
      throw new Error(message(b, 'تعذر تجديد جلسة الدخول مؤقتًا. حاول مجددًا.'));
    }
    storeSession(b, current.session_key);
    return b.access_token as string;
  };
  // Web Locks serialize rotation across tabs. The promise also deduplicates
  // requests within this tab on browsers without Web Locks.
  const promise: Promise<string> = (async () => {
    if (typeof navigator !== 'undefined' && navigator.locks) return await navigator.locks.request('septlion-auth-refresh', run);
    return run();
  })();
  const pending = { key: expected.session_key, promise };
  refreshing = pending;
  try { return await promise; } finally { if (refreshing === pending) refreshing = null; }
}

export async function signIn(email: string, password: string): Promise<Session> {
  configured();
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email, password }),
  });
  const b = await responseBody(r);
  if (!r.ok) throw new Error(message(b, 'تعذر تسجيل الدخول'));
  saveSession(b); return b;
}
export async function signUp(email: string, password: string): Promise<any> {
  configured();
  const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email, password, data: { source: 'septlion-platform' } }),
  });
  const b = await responseBody(r);
  if (!r.ok) throw new Error(message(b, 'تعذر إنشاء الحساب'));
  if (b?.access_token) saveSession(b); return b;
}
export async function edge<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  configured();
  const initial = readSession();
  if (!initial) throw new Error('يلزم تسجيل الدخول');
  let token = needsRefresh(initial) ? await refreshSession(initial) : initial.access_token;
  const request = () => {
    currentSession(initial.session_key);
    return fetch(`${SUPABASE_URL}/functions/v1/trade-api`, {
      method: 'POST', headers: headers(token), body: JSON.stringify({ ...payload, action }),
    });
  };
  let r = await request();
  let b = await responseBody(r);
  // trade-api rejects authentication before entering action handlers, so a 401
  // can be retried once. Never replay a business error, rate limit, or 5xx.
  if (r.status === 401) {
    token = await refreshSession(initial, token);
    r = await request(); b = await responseBody(r);
    if (r.status === 401) {
      const rejected = currentSession(initial.session_key);
      if (rejected.access_token === token) clearRejected(rejected);
      throw new Error(SIGN_IN_REQUIRED);
    }
  }
  if (!r.ok) throw new Error(message(b, 'تعذر تنفيذ الطلب'));
  if (b === null) throw new Error('تعذر قراءة نتيجة الطلب.');
  return b as T;
}
export function saveSession(s: Session) { storeSession(s, crypto.randomUUID()); }
export function accessToken() { return readSession()?.access_token || null; }
export function clearSession() {
  if (typeof window === 'undefined') return;
  for (const key of [SESSION_KEY, 'septlion_access', 'septlion_refresh']) window.localStorage.removeItem(key);
}
export function hasSession() { const s = readSession(); return Boolean(s?.access_token || s?.refresh_token); }
