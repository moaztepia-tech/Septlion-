'use client';

// Shows its content only to a signed-in Septlion team member (ADMIN or SALES).
// Everyone else sees a sign-in card inside the team panel frame.
import Link from 'next/link';
import {ReactNode, useEffect, useState} from 'react';
import {hasSession} from '../lib/api';
import {operatorRole} from '../app/command-center/gate';

export function TeamGate({children, next}: {children: ReactNode; next: string}) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  useEffect(() => {
    if (!hasSession()) { setState('denied'); return; }
    operatorRole().then(role => setState(role ? 'allowed' : 'denied')).catch(() => setState('denied'));
  }, []);
  if (state === 'allowed') return <>{children}</>;
  return <section className="ops-card" aria-live="polite">
    <h1 className="ops-h1">للفريق فقط</h1>
    <p className="ops-sub">{state === 'checking' ? 'جارٍ التحقق من حسابك…' : 'هذه الصفحة لفريق سبتليون. سجّل الدخول بحساب الفريق لفتحها.'}</p>
    {state === 'denied' && <div className="ops-row" style={{marginTop: 12}}>
      <Link href={'/account?next=' + encodeURIComponent(next)} className="ops-btn pri">تسجيل الدخول</Link>
      <Link href="/demand/" className="ops-link">صفحات الطلب ←</Link>
    </div>}
  </section>;
}
