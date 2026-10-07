'use client';
import {FormEvent, useEffect, useRef, useState} from 'react';
import {PlatformHeader} from '../../components/platform-header';
import {edge, hasSession, sessionUserId} from '../../lib/api';
import {createTradeRequirement} from '../../lib/trade-data';
import {COMPOSER_DRAFT_KEY, ComposerDraft, RequirementField, answerRequirement, draftFromFeed, emptyComposerDraft, isFeedContext, missingComposerFields, requirementFields, reorderPayload, requirementPayload, requirementQuestion, restoreComposerDraft} from '../../lib/composer-draft';

const labels = {
  ar: {product:'المنتج', application:'الاستخدام', quantity:'الكمية والوحدة', packing:'التعبئة', destination:'الدولة أو الميناء', incoterm:'شرط التجارة', payment:'طريقة الدفع'},
  en: {product:'Product', application:'Use', quantity:'Quantity and unit', packing:'Pack size', destination:'Country or port', incoterm:'Trade term', payment:'Payment method'},
};
export default function RequirePage() {
  const [lang,setLang] = useState<'ar'|'en'>('ar');
  const [draft,setDraft] = useState<ComposerDraft>(()=>emptyComposerDraft(''));
  const [hydrated,setHydrated] = useState(false), [saving,setSaving] = useState(false);
  const [saveError,setSaveError] = useState(''), [storageError,setStorageError] = useState(false);
  const [undo,setUndo] = useState<ComposerDraft|null>(null);
  const mounted = useRef(false), busy = useRef(false), box = useRef<HTMLTextAreaElement>(null), end = useRef<HTMLDivElement>(null);
  const ar = lang === 'ar', missing = missingComposerFields(draft), ready = missing.length === 0;

  useEffect(()=>{
    if (mounted.current) return;
    mounted.current = true;
    const id = crypto.randomUUID(), ownerId = sessionUserId();
    let next = emptyComposerDraft(id);
    try {
      const feedRaw = sessionStorage.getItem('septlion_feed_context');
      const seed = sessionStorage.getItem('septlion_requirement_seed');
      if (feedRaw) {
        const feed = JSON.parse(feedRaw);
        if (isFeedContext(feed)) next = draftFromFeed(feed,id);
      } else if (seed) {
        let context = {};
        try {context = JSON.parse(sessionStorage.getItem('septlion_requirement_context') || '{}');} catch {}
        next = answerRequirement({...next,data:context},seed,'ar');
      } else {
        const restored = restoreComposerDraft(sessionStorage.getItem(COMPOSER_DRAFT_KEY),ownerId);
        if (restored) next = restored;
        else {
          const pending = JSON.parse(sessionStorage.getItem('septlion_pending_requirement') || 'null');
          if (isFeedContext(pending)) next = draftFromFeed(pending,id);
          else if (pending && typeof pending === 'object') next = restoreComposerDraft(JSON.stringify({...next,data:pending}),ownerId) || next;
        }
      }
      // Persist first: interrupted navigation must not consume the only draft.
      next = {...next,ownerId};
      sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify(next));
      for (const key of ['septlion_feed_context','septlion_requirement_seed','septlion_requirement_context','septlion_pending_requirement']) sessionStorage.removeItem(key);
    } catch {setStorageError(true);}
    setDraft(next); setHydrated(true);
  },[]);
  useEffect(()=>{
    if (!hydrated) return;
    try {sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify(draft));setStorageError(false);} catch {setStorageError(true);}
  },[draft,hydrated]);

  function submit(event?:FormEvent) {
    event?.preventDefault();
    if (!draft.input.trim() || saving || draft.savedRequirementId) return;
    setDraft(d=>answerRequirement(d,d.input,lang)); setSaveError('');
    requestAnimationFrame(()=>{end.current?.scrollIntoView({block:'nearest'});box.current?.focus();});
  }
  function edit(field:RequirementField,value:string) {
    setDraft(d=>({...d,data:{...d.data,[field]:value}}));setSaveError('');
  }
  function reset() {
    if (saving) return;
    setUndo(draft); setDraft({...emptyComposerDraft(crypto.randomUUID()),ownerId:sessionUserId()});setSaveError('');
  }
  async function save() {
    if (busy.current || !ready || draft.savedRequirementId) return;
    busy.current=true;setSaving(true);setSaveError('');
    try {
      const input=draft.reorder?reorderPayload(draft):requirementPayload(draft);
      if (!hasSession()) {
        // The draft includes all edits and the conversation, not only Feed defaults.
        sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify(draft));
        window.location.href='/account?next='+encodeURIComponent('/require');return;
      }
      const result=draft.reorder?await edge<{id:string}>('reorder.create',input):await createTradeRequirement(input);
      const id='item' in result?result.item.id:result.id;
      if (!id) throw new Error(ar?'تعذر قراءة مرجع الطلب المحفوظ.':'Could not read the saved request reference.');
      setDraft(d=>({...d,savedRequirementId:id}));
      sessionStorage.setItem(COMPOSER_DRAFT_KEY,JSON.stringify({...draft,savedRequirementId:id,ownerId:sessionUserId()}));
      sessionStorage.setItem('septlion_active_request',id);
      window.location.href='/request?id='+encodeURIComponent(id);
    } catch (e) {setSaveError(e instanceof Error?e.message:(ar?'تعذر إرسال الطلب. مسودتك ما زالت هنا.':'Could not send. Your draft is still here.'));}
    finally {busy.current=false;setSaving(false);}
  }
  const lastReply=draft.messages.filter(m=>m.role==='assistant').at(-1)?.text;
  return <main className="chat-ai customer-composer" dir={ar?'rtl':'ltr'} lang={lang}>
    <PlatformHeader lang={lang} actions={<><button className="secondary-link" disabled={saving} onClick={reset}>{ar?'طلب جديد':'New request'}</button><button className="platform-action" onClick={()=>setLang(ar?'en':'ar')} aria-label={ar?'Switch to English':'التبديل إلى العربية'}>{ar?'EN':'ع'}</button></>}/>
    <section className={'chat-stage '+(draft.messages.length?'has-chat':'')} aria-labelledby="composer-title">
      <div className="composer-status"><span>{storageError?(ar?'تعذر حفظ المسودة على هذا الجهاز':'Draft storage unavailable'):(ar?'مسودتك محفوظة في هذا التبويب':'Draft saved in this tab')}</span><span>{ar?'طلب توريد · Composer':'Supply request · Composer'}</span></div>
      {undo&&<p className="composer-undo" role="status">{ar?'بدأت طلبًا جديدًا.':'New request started.'} <button onClick={()=>{setDraft(undo);setUndo(null);}}>{ar?'استعادة الطلب السابق':'Restore previous request'}</button></p>}
      <div className="intent-canvas"><div className="chat-thread">
        <div className="chat-welcome"><h1 id="composer-title">{draft.reorder?(ar?'مراجعة إعادة الطلب':'Review reorder'):draft.feed?(ar?'نكمل طلبك من هنا':'Continue your request'):(ar?'ماذا تحتاج؟':'What do you need?')}</h1><p>{ar?'أخبرنا باحتياجك، ثم راجع تفاصيله قبل إرساله لإعداد عرض Septlion.':'Describe your need, then review the details before requesting a Septlion offer.'}</p></div>
        {draft.reorder&&<p className={draft.reorder.testOnly?'test-notice':'workspace-muted'}>{draft.reorder.testOnly?'TEST — إعادة طلب لمحاكاة غير تجارية. ':''}{ar?'ستحتفظ هذه الإعادة بالتكوين المعتمد مع إمكانية تعديل الكمية. السعر والتوفر وموعد الشحن تُراجع في عرض جديد.':'This reorder preserves the approved configuration. You can change the quantity. Price, availability and shipping date will be checked in a new offer.'}</p>}
        {draft.feed&&<div className="feed-context-card"><div><small>{ar?'منتج اخترته من اكتشف':'Selected in Discover'} · {draft.feed.buyer.company}</small><b>{draft.feed.product.name}</b></div><span>{ar?'معلومات اختيارك مرفقة، والتعديلات أدناه هي تفاصيل الطلب الذي سيُرسل.':'Your selection is attached. The edited details below will be sent.'}</span></div>}
        <div className="composer-conversation" role="log" aria-label={ar?'محادثة الطلب':'Request conversation'}>
          {draft.feed&&!draft.messages.length&&missing.length>0&&<div className="chat-msg assistant"><div>{requirementQuestion(missing[0],lang,draft.feed)}</div></div>}
          {draft.messages.map((message,i)=><div key={i} className={'chat-msg '+message.role}><div>{message.text}</div></div>)}
        </div>
        <span className="sr-only" aria-live="polite">{lastReply}</span>
        {Object.keys(draft.data).length>0&&<section className="composer-review" aria-labelledby="review-title">
          <div className="composer-review-head"><div><small>{ar?'تفاصيل الطلب':'REQUEST DETAILS'}</small><h2 id="review-title">{ar?'راجع ما سنرسله':'Review what we will send'}</h2></div><span>{ready?(ar?'الأساسيات مكتملة':'Essentials complete'):(ar?missing.length+' معلومات متبقية':missing.length+' details remaining')}</span></div>
          <p>{draft.reorder?(ar?'يمكنك تعديل الكمية بوحدة '+draft.reorder.unit+'. لبقية التغييرات، ابدأ طلبًا جديدًا.':'Change the quantity in '+draft.reorder.unit+'. Start a new request for other changes.'):(ar?'يمكنك تعديل أي حقل مباشرة. التعبئة غير المحددة تبقى للمناقشة، ولا نعتمد مواصفة نيابةً عنك.':'Edit any field directly. Unconfirmed packing remains to be agreed with you.')}</p>
          <div className="composer-field-grid">{requirementFields.filter(k=>k!=='application'||(!draft.reorder&&/flour|دقيق/i.test(draft.data.product||''))).map(field=><label key={field}><span>{labels[lang][field]}{missing.includes(field)&&<small>{ar?' مطلوب':' required'}</small>}</span>{!draft.reorder&&(field==='incoterm'||field==='payment')?<select disabled={saving||!!draft.savedRequirementId} value={draft.data[field]||''} onChange={e=>edit(field,e.target.value)}><option value="">{ar?'اختر':'Choose'}</option>{(field==='incoterm'?[['CIF','CIF'],['CFR','CFR'],['FOB','FOB']]:[['L/C',ar?'L/C — اعتماد مستندي':'L/C'],['T/T',ar?'T/T — تحويل بنكي':'T/T'],['OTHER',ar?'تُناقش في العرض':'Discuss in the offer']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:<input disabled={saving||!!draft.savedRequirementId||!!draft.reorder&&field!=='quantity'} value={draft.data[field]||''} onChange={e=>edit(field,e.target.value)} placeholder={field==='quantity'?(ar?'مثل: 5 FCL أو 40 MT':'e.g. 5 FCL or 40 MT'):field==='packing'?(ar?'مثل: 50 كجم أو تُحدد مع Septlion':'e.g. 50 kg or agree with Septlion'):''} maxLength={2000} autoComplete="off"/>}</label>)}</div>
          {!draft.reorder&&<label className="composer-notes"><span>{ar?'ملاحظات المواصفة والتوريد — اختياري':'Specification and supply notes — optional'}</span><textarea disabled={saving||!!draft.savedRequirementId} value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} maxLength={8000} rows={3} placeholder={ar?'أضف متطلبات الجودة أو التعبئة أو أي تفصيل مهم لعرضك…':'Add quality, packaging or other requirements for your offer…'}/></label>}
          {draft.savedRequirementId?<a className="primary-link" href={'/request?id='+encodeURIComponent(draft.savedRequirementId)}>{ar?'فتح الطلب الذي أُرسل':'Open submitted request'}</a>:<div className="composer-review-actions"><p>{ready?(ar?'الإرسال يطلب إعداد عرض؛ تثبيت الشروط يتم عند قبول العرض لاحقًا.':'Sending requests an offer. Terms are locked when you accept the offer later.'):requirementQuestion(missing[0],lang,draft.feed)}</p><button className="primary-link" disabled={!hydrated||!ready||saving} onClick={()=>void save()}>{saving?(ar?'جارٍ الإرسال…':'Sending…'):(ar?'إرسال الطلب لإعداد العرض':'Request a Septlion offer')}</button></div>}
          {saveError&&<p className="workspace-error" role="alert">{saveError}</p>}
        </section>}
        <div ref={end}/>
      </div></div>
      <form className="chat-composer-wrap" onSubmit={submit}><div className="chat-composer"><textarea aria-label={ar?'احتياجك أو إجابتك':'Your requirement or answer'} ref={box} rows={2} disabled={saving||!!draft.savedRequirementId} value={draft.input} onChange={e=>setDraft(d=>({...d,input:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}} maxLength={4000} placeholder={draft.feed?(ar?'أجب عن السؤال أو اكتب التعديل المطلوب…':'Answer the question or describe a change…'):(ar?'اكتب ما تحتاجه…':'Describe your requirement…')}/><div className="chat-tools"><span className="trade-capability">{ar?'سؤال واحد في كل مرة · ويمكنك تعديل الملخص':'One question at a time · editable summary'}</span><button type="submit" className="chat-send" disabled={!hydrated||!draft.input.trim()||saving||!!draft.savedRequirementId} aria-label={ar?'إضافة إلى الطلب':'Add to requirement'}>↑</button></div></div>{!draft.messages.length&&!draft.feed&&!draft.reorder&&<p className="chat-hint">{ar?'مثال: أحتاج 5 حاويات دقيق مخابز بتعبئة 50 كجم إلى تنزانيا':'Example: 5 containers of bakery flour, 50 kg bags, to Tanzania'}</p>}</form>
    </section>
    <footer className="chat-foot">SEPTLION · From demand to trade.</footer>
  </main>;
}
