export function authReturnPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020]/.test(next)) return null;
  try {
    const url = new URL(next, origin);
    return url.origin === new URL(origin).origin ? url.pathname + url.search + url.hash : null;
  } catch { return null; }
}
