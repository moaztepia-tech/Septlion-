'use client';
import {DesignButton} from "../../components/design-system";

import {useEffect, useState} from 'react';
import {BuyerShell} from '../../components/buyer-shell';
import {DesignCard, DesignLink} from '../../components/design-system';
import {hasSession, sessionUserId} from '../../lib/api';
import {COMPOSER_DRAFT_KEY, restoreComposerDraft} from '../../lib/composer-draft';
import {tradeRequests} from '../../lib/trade-data';
import type {UiRequest} from '../../lib/buyer-ui-store';

export default function MySeptlion() {
  const [requests, setRequests] = useState<UiRequest[]>([]);
  const [draftProduct, setDraftProduct] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const logged = hasSession(); setSignedIn(logged);
    try {
      const draft = restoreComposerDraft(sessionStorage.getItem(COMPOSER_DRAFT_KEY), sessionUserId());
      setDraftProduct(draft && !draft.savedRequirementId ? draft.data.product || '' : '');
    } catch {}
    if (!logged) {setLoading(false); return;}
    void tradeRequests().then(rows => {if (active) setRequests(rows);}).catch(e => {if (active) setError(e instanceof Error ? e.message : 'تعذر تحميل طلباتك.');}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [refresh]);
  return <BuyerShell title="My Septlion" eyebrow="مساحتك التجارية"><section className="buyer-section">
    <div className="section-intro"><small>MY SEPTLION</small><h1>كل توريد، في مكان واحد.</h1><p>ابدأ احتياجًا جديدًا، أو تابع الطلب والعرض والصفقة المرتبطة به.</p></div>
    {draftProduct && <DesignCard><small>مسودة محفوظة في هذا التبويب</small><h2>{draftProduct}</h2><p>أكمل التفاصيل داخل محرّر الطلب، ثم راجعها قبل الإرسال.</p><DesignLink href="/require">متابعة المسودة</DesignLink></DesignCard>}
    <div className="hub-grid">
      <DesignCard><small>طلبات التوريد</small><h2>طلباتي</h2><p>{loading ? 'جارٍ تحميل الطلبات…' : signedIn && !error ? `${requests.length} طلب مسجل` : 'الطلبات والعروض وحالة التنفيذ'}</p><DesignLink href="/requests" className="secondary">فتح طلباتي</DesignLink></DesignCard>
      <DesignCard><small>هوية المؤسسة</small><h2>ملف الشركة</h2><p>بيانات التواصل التي ترافق طلبات التوريد.</p><DesignLink href="/company" className="secondary">ملف الشركة</DesignLink></DesignCard>
    </div>
    {error && <div className="empty-state"><p role="alert">{error}</p><DesignButton className="secondary-link" onClick={() => setRefresh(n => n + 1)}>إعادة المحاولة</DesignButton></div>}
    {!signedIn && <DesignCard><h2>تابع طلبات مؤسستك</h2><p>سجّل الدخول للوصول إلى طلباتك وعروضك ومراحل التنفيذ.</p><DesignLink href="/account?next=%2Fmy-septlion">تسجيل الدخول</DesignLink></DesignCard>}
    {!loading && signedIn && !error && requests.length > 0 && <section className="request-list" aria-label="آخر الطلبات">{requests.slice(0,3).map(request => <a className="request-row" key={request.id} href={'/request?id='+encodeURIComponent(request.id)}><div><small>طلب توريد</small><b>{request.product}</b><p>{request.quantityLabel} · {request.destination}</p></div><span>تفاصيل الطلب ←</span></a>)}</section>}
    <DesignLink href="/require">ابدأ طلب توريد</DesignLink>
  </section></BuyerShell>;
}
