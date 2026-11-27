'use client';
import {useEffect, useMemo, useState} from 'react';
import {OpsFrame} from '../../components/ops-console';
import {hasSession, rpc} from '../../lib/api';
import {CONTENT, fetchSiteContent, type ContentSection} from '../../lib/site-content';
import {operatorRole} from '../command-center/gate';

type State = 'checking' | 'denied' | 'ready';

export default function SiteContentEditor() {
 const [state, setState] = useState<State>('checking');
 const [saved, setSaved] = useState<Record<string, string>>({});
 const [draft, setDraft] = useState<Record<string, string>>({});
 const [busy, setBusy] = useState('');
 const [note, setNote] = useState<{id: string; ok: boolean; text: string} | null>(null);

 async function load() {
  const v = await fetchSiteContent();
  setSaved(v);
  setDraft(Object.fromEntries(CONTENT.flatMap(s => s.fields.map(f => [f.key, v[f.key] || f.def]))));
 }
 useEffect(() => {
  if (!hasSession()) { setState('denied'); return; }
  operatorRole().then(role => { if (!role) { setState('denied'); return; } return load().then(() => setState('ready')); })
   .catch(() => setState('denied'));
 }, []);

 const current = (key: string, def: string) => saved[key] || def;
 const changed = useMemo(() => new Set(CONTENT.flatMap(s => s.fields.filter(f => (draft[f.key] ?? '').trim() !== current(f.key, f.def)).map(f => f.key))), [draft, saved]); // eslint-disable-line react-hooks/exhaustive-deps

 async function save(section: ContentSection) {
  const items = section.fields.filter(f => changed.has(f.key)).map(f => {
   const v = (draft[f.key] ?? '').trim();
   return {key: f.key, value: v === f.def ? '' : v};
  });
  if (!items.length) return;
  setBusy(section.id); setNote(null);
  try {
   await rpc<number>('site_content_save', {items});
   await load();
   setNote({id: section.id, ok: true, text: 'حُفظ ✓ ويظهر على الموقع عند فتح الصفحة.'});
  } catch (e) {
   setNote({id: section.id, ok: false, text: e instanceof Error ? e.message : 'تعذر الحفظ'});
  } finally { setBusy(''); }
 }

 if (state !== 'ready') return <OpsFrame active="content"><section className="ops-card" style={{maxWidth: 520, margin: '8vh auto 0', textAlign: 'center'}}>
  <h1 className="ops-h1">محتوى الموقع</h1>
  <p className="ops-sub">{state === 'checking' ? 'جارٍ التحقق من حسابك…' : 'هذه الصفحة لفريق سبتليون فقط. سجّل الدخول بحساب الفريق.'}</p>
  {state === 'denied' && <a className="ops-btn pri" href="/account?next=/site-content" style={{marginTop: 12}}>تسجيل الدخول</a>}
 </section></OpsFrame>;

 return <OpsFrame active="content">
  <div>
   <h1 className="ops-h1">محتوى الموقع</h1>
   <p className="ops-sub">عدّل النص واضغط «حفظ». يظهر التعديل لزوار الموقع فور فتحهم الصفحة. اترك الحقل كما هو أو استعد النص الأصلي في أي وقت.</p>
  </div>
  {CONTENT.map(section => {
   const dirty = section.fields.some(f => changed.has(f.key));
   return <section key={section.id} className="ops-card sc-section" aria-labelledby={'sc-' + section.id}>
    <div className="ops-row"><h2 id={'sc-' + section.id} className="ops-h2">{section.title}</h2><a className="ops-link" href={section.page} target="_blank" rel="noreferrer">عرض الصفحة ↗</a></div>
    <div className="sc-fields">
     {section.fields.map(f => {
      const value = draft[f.key] ?? '';
      const custom = Boolean(saved[f.key]);
      return <label key={f.key} className={'sc-field' + (changed.has(f.key) ? ' sc-changed' : '')}>
       <span className="sc-label">{f.label}{custom && <em>معدّل</em>}</span>
       {f.long
        ? <textarea rows={3} maxLength={2000} value={value} onChange={e => setDraft(d => ({...d, [f.key]: e.target.value}))}/>
        : <input maxLength={2000} value={value} onChange={e => setDraft(d => ({...d, [f.key]: e.target.value}))}/>}
       {value.trim() !== f.def && <button type="button" className="ops-link sc-reset" onClick={() => setDraft(d => ({...d, [f.key]: f.def}))}>استعادة النص الأصلي</button>}
      </label>;
     })}
    </div>
    <div className="ops-row sc-actions">
     {note?.id === section.id ? <p className={note.ok ? 'ops-ok' : 'ops-alert'} role="status">{note.text}</p> : <span className="ops-sub">{dirty ? 'لديك تعديلات لم تُحفظ.' : ' '}</span>}
     <div style={{display: 'flex', gap: 8}}>
      {dirty && <button type="button" className="ops-btn" disabled={!!busy} onClick={() => setDraft(d => ({...d, ...Object.fromEntries(section.fields.map(f => [f.key, current(f.key, f.def)]))}))}>تراجع</button>}
      <button type="button" className="ops-btn pri" disabled={!dirty || !!busy} onClick={() => void save(section)}>{busy === section.id ? 'جارٍ الحفظ…' : 'حفظ'}</button>
     </div>
    </div>
   </section>;
  })}
 </OpsFrame>;
}
