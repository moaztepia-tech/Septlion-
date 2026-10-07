import {extractRequirement, mergeRequirementInput} from './requirement-input';
import type {TradeWorkspace} from './trade-transaction';

export const COMPOSER_DRAFT_KEY = 'septlion_composer_draft_v2';
export const requirementFields = ['product', 'application', 'quantity', 'packing', 'destination', 'incoterm', 'payment'] as const;
export type RequirementField = typeof requirementFields[number];
export type RequirementData = Partial<Record<RequirementField, string>>;
export type FeedContext = {
  source: 'product_feed'; createdAt?: string;
  product: {id: string; name: string; nameEn: string; packing: string};
  containerCount: number; septlionScale: string; incoterm: string;
  destination: {port: string; country: string; code: string}; paymentPreference: string;
  buyer: {name: string; company: string; whatsapp: string; email: string | null; whatsappStatus: string};
};
export type ComposerDraft = {
  version: 2; id: string; ownerId?: string; data: RequirementData; feed: FeedContext | null;
  messages: Array<{role: 'user' | 'assistant'; text: string}>;
  input: string; notes: string; savedRequirementId?: string;
  reorder?: {transactionId: string; unit: string; testOnly: boolean};
};
export function isFeedContext(value: unknown): value is FeedContext {
  if (!value || typeof value !== 'object') return false;
  const feed = value as FeedContext;
  return feed.source === 'product_feed' && Number.isInteger(feed.containerCount) && feed.containerCount > 0
    && !!feed.product && ['id','name','nameEn','packing'].every(key => typeof feed.product[key as keyof FeedContext['product']] === 'string')
    && !!feed.destination && ['port','country','code'].every(key => typeof feed.destination[key as keyof FeedContext['destination']] === 'string')
    && typeof feed.incoterm === 'string' && typeof feed.paymentPreference === 'string' && !!feed.buyer && typeof feed.buyer.company === 'string';
}

export function emptyComposerDraft(id: string): ComposerDraft {
  return {version: 2, id, data: {}, feed: null, messages: [], input: '', notes: ''};
}
export function draftFromFeed(feed: FeedContext, id: string): ComposerDraft {
  return {...emptyComposerDraft(id), feed, data: {
    product: feed.product.nameEn, quantity: feed.containerCount + ' FCL',
    // A list of available packs is not a buyer's selected pack.
    ...(!feed.product.packing.includes('·') ? {packing: feed.product.packing} : {}),
    ...(feed.product.id === 'flour-bakery' ? {application: 'Bakery'} : {}),
    destination: feed.destination.port, incoterm: feed.incoterm,
    ...(feed.paymentPreference !== 'UNSPECIFIED' ? {payment: feed.paymentPreference} : {}),
  }};
}
export function draftFromReorder(workspace: TradeWorkspace, id: string): ComposerDraft {
  if (workspace.item.status !== 'COMPLETED' || !workspace.commercialLock) throw new Error('إعادة الطلب متاحة بعد اكتمال الصفقة.');
  const snapshot = workspace.commercialLock.snapshot, first = snapshot.items[0], terms = snapshot.terms;
  if (!first) throw new Error('تعذر قراءة التكوين المعتمد.');
  const unit = normalizeQuantityUnit(first.unit);
  return {...emptyComposerDraft(id), reorder: {transactionId: workspace.item.id, unit, testOnly: workspace.item.testOnly}, data: {
    product: snapshot.product || first.description, quantity: first.quantity + ' ' + unit,
    packing: String(terms.packing || ''), destination: String(terms.destination || ''), incoterm: String(terms.incoterm || ''), payment: String(terms.payment || ''),
  }};
}
function normalizeQuantityUnit(unit: string) {
  if (/^(FCL|CONTAINERS?|حاوي(?:ة|ات))$/i.test(unit.trim())) return 'FCL';
  if (/^(MT|TONS?|طن)$/i.test(unit.trim())) return 'MT';
  if (/^(KG|كجم|كيلو)$/i.test(unit.trim())) return 'KG';
  return unit.trim().toUpperCase();
}
function reorderQuantityDetails(draft: ComposerDraft, value = draft.data.quantity || '') {
  if (!draft.reorder) return null;
  const text = value.replace(/[٠-٩۰-۹]/g, n => String('٠١٢٣٤٥٦٧٨٩'.includes(n) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(n) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(n)));
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match || (match[2] && normalizeQuantityUnit(match[2]) !== draft.reorder.unit)) return null;
  const amount = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000 || (['FCL','TEU','FEU'].includes(draft.reorder.unit) && !Number.isInteger(amount))) return null;
  return {amount, unit: draft.reorder.unit};
}
export function quantityDetails(value = ''): {amount: number; unit: string} | null {
  const text = value.replace(/[٠-٩۰-۹]/g, n => String('٠١٢٣٤٥٦٧٨٩'.includes(n) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(n) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(n)));
  const match = text.trim().match(/^(\d+(?:[.,]\d+)?)\s*(FCL|MT|KG|TONS?|حاوي(?:ة|ات)|طن|كجم|كيلو)$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  const unit = /FCL|حاوي/i.test(match[2]) ? 'FCL' : /KG|كجم|كيلو/i.test(match[2]) ? 'KG' : 'MT';
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000 || (unit === 'FCL' && !Number.isInteger(amount))) return null;
  return {amount, unit};
}
export function missingRequirementFields(data: RequirementData): RequirementField[] {
  const required: RequirementField[] = ['product', ...(/flour|دقيق/i.test(data.product || '') ? ['application' as const] : []), 'quantity', 'packing', 'destination', 'incoterm', 'payment'];
  return required.filter(key => !data[key]?.trim() || (key === 'quantity' && !quantityDetails(data.quantity)) || (key === 'incoterm' && !['CIF','CFR','FOB'].includes(data.incoterm || '')) || (key === 'payment' && !['L/C','T/T','OTHER'].includes(data.payment || '')));
}
export function missingComposerFields(draft: ComposerDraft): RequirementField[] {
  if (!draft.reorder) return missingRequirementFields(draft.data);
  return reorderQuantityDetails(draft) ? [] : ['quantity'];
}
export function reorderPayload(draft: ComposerDraft) {
  const quantity = reorderQuantityDetails(draft);
  if (!draft.reorder || !quantity) throw new Error('راجع الكمية باستخدام وحدة الطلب السابق: ' + (draft.reorder?.unit || ''));
  return {transactionId: draft.reorder.transactionId, quantity: quantity.amount, idempotencyKey: draft.id};
}
export function requirementQuestion(field: RequirementField, lang: 'ar' | 'en', feed: FeedContext | null = null): string {
  const ar: Record<RequirementField, string> = {product: 'ما المنتج الذي تحتاجه؟', application: 'ما استخدام الدقيق: للمخابز أم لاستخدام آخر؟', quantity: 'ما الكمية مع الوحدة؟ مثل 5 حاويات أو 40 طنًا.', packing: feed ? 'أي حجم تعبئة تفضله من الخيارات المتاحة: ' + feed.product.packing + '؟ ويمكنك تحديد تعبئة أخرى.' : 'ما حجم التعبئة الذي تفضله؟ وإذا لم تكن متأكدًا اكتب: تُحدد مع Septlion.', destination: 'إلى أي دولة أو ميناء تريد التوريد؟', incoterm: 'ما شرط التجارة الذي تفضله: CIF أو CFR أو FOB؟', payment: 'ما طريقة الدفع التي تفضلها: L/C أو T/T، أم تُناقش في العرض؟'};
  const en: Record<RequirementField, string> = {product: 'What product do you need?', application: 'How will the flour be used: bakery or another use?', quantity: 'What quantity and unit do you need? For example, 5 containers or 40 MT.', packing: feed ? 'Which pack size do you prefer: ' + feed.product.packing + '? You can specify another pack.' : 'What pack size do you prefer? If unsure, say: agree with Septlion.', destination: 'Which country or port should we supply to?', incoterm: 'Which trade term do you prefer: CIF, CFR or FOB?', payment: 'Which payment method do you prefer: L/C, T/T, or discuss in the offer?'};
  return (lang === 'ar' ? ar : en)[field];
}
export function answerRequirement(draft: ComposerDraft, text: string, lang: 'ar' | 'en'): ComposerDraft {
  const answer = text.trim();
  if (!answer) return draft;
  const parsed = extractRequirement(answer);
  if (draft.reorder) {
    const directQuantity = reorderQuantityDetails(draft, answer);
    const quantity = parsed.quantity || (directQuantity ? directQuantity.amount + ' ' + directQuantity.unit : draft.data.quantity);
    return {...draft, data: {...draft.data, quantity}, input: '', messages: [...draft.messages, {role: 'user' as const, text: answer}, {role: 'assistant' as const, text: lang === 'ar' ? 'إعادة الطلب تحتفظ بالتكوين المعتمد. يمكنك تعديل الكمية بوحدة ' + draft.reorder.unit + '؛ راجعها قبل إرسال الطلب. لاحتياج مختلف، ابدأ طلبًا جديدًا.' : 'Reorder preserves the approved configuration. You can change the quantity in ' + draft.reorder.unit + ' before sending. Start a new request for different requirements.'}].slice(-100)};
  }
  const data: RequirementData = mergeRequirementInput(answer, draft.data);
  const next = missingRequirementFields(draft.data)[0];
  if (next && !parsed[next] && Object.keys(parsed).length === 0) {
    data[next] = next === 'payment' && /ناقش|تحدد|تُحدد|أخرى|اخرى|other|discuss/i.test(answer) ? 'OTHER'
      : next === 'packing' && /لا أعرف|لا اعرف|غير متأكد|not sure|تُحدد|تحدد|agree with/i.test(answer) ? (lang === 'ar' ? 'تُحدد مع Septlion' : 'Agree with Septlion') : answer;
  }
  const missing = missingRequirementFields(data);
  const reply = missing.length ? requirementQuestion(missing[0], lang, draft.feed)
    : lang === 'ar' ? 'اكتملت الأساسيات. راجع ملخص الطلب وعدّل أي معلومة قبل إرساله لإعداد العرض.' : 'The essentials are complete. Review and correct the summary before sending it for an offer.';
  return {...draft, data, input: '', messages: [...draft.messages, {role: 'user' as const, text: answer}, {role: 'assistant' as const, text: reply}].slice(-100)};
}
export function requirementPayload(draft: ComposerDraft): Record<string, unknown> {
  if (missingRequirementFields(draft.data).length) throw new Error('أكمل المعلومات الأساسية وراجع الكمية ووحدتها.');
  const quantity = quantityDetails(draft.data.quantity)!;
  const originalDestination = draft.feed?.destination;
  return {
    ...draft.data, quantity: quantity.amount + ' ' + quantity.unit, unit: quantity.unit,
    containerCount: quantity.unit === 'FCL' ? quantity.amount : null,
    paymentPreference: draft.data.payment,
    ...(originalDestination && draft.data.destination === originalDestination.port ? {deliveryCountry: originalDestination.country, destinationCode: originalDestination.code} : {}),
    source: draft.feed ? 'PRODUCT_FEED' : 'AI_COMPOSER',
    sourceContext: draft.feed ? {...draft.feed, reviewedRequirement: draft.data} : {path: 'require'},
    knownFacts: {...draft.data, notes: draft.notes.trim(), conversation: draft.messages.filter(x => x.role === 'user').map(x => x.text)},
  };
}
export function restoreComposerDraft(raw: string | null, ownerId?: string): ComposerDraft | null {
  try {
    const draft = JSON.parse(raw || 'null');
    if (draft?.version !== 2 || typeof draft.id !== 'string' || !draft.data || Array.isArray(draft.data) || (draft.ownerId && draft.ownerId !== ownerId)) return null;
    const data: RequirementData = {};
    for (const key of requirementFields) if (typeof draft.data[key] === 'string') data[key] = draft.data[key].slice(0,2000);
    return {...emptyComposerDraft(draft.id), data, ...(typeof draft.ownerId === 'string' ? {ownerId: draft.ownerId} : {}), feed: isFeedContext(draft.feed) ? draft.feed : null,
      messages: Array.isArray(draft.messages) ? draft.messages.filter((x: any) => ['user','assistant'].includes(x?.role) && typeof x.text === 'string').slice(-100).map((x: any) => ({role:x.role,text:x.text.slice(0,4000)})) : [],
      input: typeof draft.input === 'string' ? draft.input.slice(0,4000) : '', notes: typeof draft.notes === 'string' ? draft.notes.slice(0,8000) : '',
      ...(typeof draft.reorder?.transactionId === 'string' && typeof draft.reorder.unit === 'string' ? {reorder: {transactionId: draft.reorder.transactionId, unit: draft.reorder.unit, testOnly: Boolean(draft.reorder.testOnly)}} : {}),
      ...(typeof draft.savedRequirementId === 'string' ? {savedRequirementId: draft.savedRequirementId} : {})};
  } catch { return null; }
}
