import {normalizeSupplyPlan, SupplyPlan} from './supply-plan';
import {extractRequirement, mergeRequirementInput} from './requirement-input';
import type {TradeWorkspace} from './trade-transaction';

export const COMPOSER_DRAFT_KEY = 'septlion_composer_draft_v2';
export const requirementFields = ['product', 'application', 'quantity', 'packing', 'destination', 'incoterm', 'payment'] as const;
export type RequirementField = typeof requirementFields[number];
export type RequirementData = Partial<Record<RequirementField, string>>;
export type FeedContext = {
  source: 'product_feed'; createdAt?: string; catalogProductId?:string; variants?:{skuId:string;containers:number}[];
  product: {id: string; name: string; nameEn: string; packing: string};
  containerCount: number; containerSize?: '20' | '40'; septlionScale: string; incoterm: string;
  destination: {port: string; country: string; code: string}; paymentPreference: string;
  buyer: {name: string; company: string; whatsapp: string; email: string | null; whatsappStatus: string};
};
export type ComposerDraft = {
  composerVisited?: boolean;
  version: 2; id: string; ownerId?: string; data: RequirementData; feed: FeedContext | null;
  messages: Array<{role: 'user' | 'assistant'; text: string}>;
  supplyPlan?: SupplyPlan | null;
  input: string; notes: string; savedRequirementId?: string;
  reorder?: {transactionId: string; unit: string; testOnly: boolean};
};
export function isFeedContext(value: unknown): value is FeedContext {
  if (!value || typeof value !== 'object') return false;
  const feed = value as FeedContext;
  return feed.source === 'product_feed' && Number.isInteger(feed.containerCount) && feed.containerCount > 0
    && !!feed.product && ['id','name','nameEn','packing'].every(key => typeof feed.product[key as keyof FeedContext['product']] === 'string')
    && !!feed.destination && ['port','country','code'].every(key => typeof feed.destination[key as keyof FeedContext['destination']] === 'string')
    && (feed.containerSize === undefined || feed.containerSize === '20' || feed.containerSize === '40')
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
    destination: feed.destination.port || feed.destination.country, incoterm: feed.incoterm,
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
// Greetings, thanks and small talk get a short human answer and the current question.
// They are never stored as a product or any other field.
const smallTalkWords = new RegExp('(?:'+['السلام عليكم(?: ورحمة الله(?: وبركاته)?)?','الله يعطيك العافية','يعطيك العافية','وعليكم السلام','good evening','ممكن تساعدني','good morning','محتاج مساعدة','how are you','ممكن مساعدة','مساء النور','صباح النور','صباح الخير','مساء الخير','هلا والله','thank you','كيف الحال','كيف حالكم','عندي سؤال','كيف حالك','يا أستاذ','عامل ايه','يا استاذ','من فضلك','لو سمحت','شلونكم','يا أخي','thanks','مرحباً','يا اخي','مرحبًا','please','ممتاز','شكرًا','شكراً','salam','اهلًا','مشكور','مرحبا','أهلًا','شلونك','hello','اهلين','شكرا','إزيك','أوكي','سلام','ازيك','اهلا','اوكي','okay','كيفك','تمام','أهلا','hey','هاي','هلا','طيب','ok','hi'].join('|')+')','gi');
export function smallTalk(text: string): 'salam' | 'thanks' | 'hello' | null {
  const rest = text.toLowerCase().replace(smallTalkWords, ' ').replace(/[\s\p{P}\p{S}]+/gu, '');
  if (rest) return null;
  if (/السلام|سلام|salam/i.test(text)) return 'salam';
  if (/شكر|مشكور|العافية|thank/i.test(text)) return 'thanks';
  return 'hello';
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
  const talk = smallTalk(answer);
  if (talk) {
    const missingNow = missingRequirementFields(draft.data);
    const opener = lang === 'ar'
      ? talk === 'salam' ? 'وعليكم السلام ورحمة الله، أهلًا بك في سبتليون. ' : talk === 'thanks' ? 'العفو، بكل سرور. ' : 'أهلًا بك في سبتليون، يسعدنا خدمتك. '
      : talk === 'thanks' ? 'You are welcome. ' : 'Hello, welcome to Septlion. ';
    const question = missingNow.length ? requirementQuestion(missingNow[0], lang, draft.feed)
      : lang === 'ar' ? 'طلبك جاهز للمراجعة متى شئت.' : 'Your request is ready to review.';
    return {...draft, input: '', messages: [...draft.messages, {role: 'user' as const, text: answer}, {role: 'assistant' as const, text: opener + question}].slice(-100)};
  }
  const data: RequirementData = mergeRequirementInput(answer, draft.data);
  const next = missingRequirementFields(draft.data)[0];
  const asked = looksLikeQuestion(answer) && Object.keys(parsed).length === 0;
  if (asked) {
    const missingNow = missingRequirementFields(draft.data);
    const holding = lang === 'ar' ? 'سؤال في محله. الأسعار والمواعيد وشروط الدفع تصلك في عرض سبتليون المكتوب بعد مراجعة طلبك.' : 'Good question. Prices, dates and payment terms come in Septlion\'s written offer after your request is reviewed.';
    const follow = missingNow.length ? requirementQuestion(missingNow[0], lang, draft.feed) : lang === 'ar' ? 'طلبك جاهز للمراجعة متى شئت.' : 'Your request is ready to review.';
    return {...draft, input: '', messages: [...draft.messages, {role: 'user' as const, text: answer}, {role: 'assistant' as const, text: holding + '\n\n' + follow}].slice(-100)};
  }
  if (next && !parsed[next] && Object.keys(parsed).length === 0) {
    data[next] = next === 'payment' && /ناقش|تحدد|تُحدد|أخرى|اخرى|other|discuss/i.test(answer) ? 'OTHER'
      : next === 'packing' && /لا أعرف|لا اعرف|غير متأكد|not sure|تُحدد|تحدد|agree with/i.test(answer) ? (lang === 'ar' ? 'تُحدد مع Septlion' : 'Agree with Septlion') : answer;
  }
  const missing = missingRequirementFields(data);
  const reply = missing.length ? requirementQuestion(missing[0], lang, draft.feed)
    : lang === 'ar' ? 'اكتملت الأساسيات. راجع ملخص الطلب وعدّل أي معلومة قبل إرساله لإعداد العرض.' : 'The essentials are complete. Review and correct the summary before sending it for an offer.';
  const salam = lang === 'ar' && /^\s*(?:ال)?سلام عليكم/.test(answer) ? 'وعليكم السلام. ' : '';
  return {...draft, data, input: '', messages: [...draft.messages, {role: 'user' as const, text: answer}, {role: 'assistant' as const, text: salam + reply}].slice(-100)};
}
export function requirementPayload(draft: ComposerDraft): Record<string, unknown> {
  if (missingRequirementFields(draft.data).length) throw new Error('أكمل المعلومات الأساسية وراجع الكمية ووحدتها.');
  const quantity = quantityDetails(draft.data.quantity)!;
  const originalDestination = draft.feed?.destination;
  return {
    ...draft.data, idempotencyKey: draft.id, quantity: quantity.amount + ' ' + quantity.unit, unit: quantity.unit,
    containerCount: quantity.unit === 'FCL' ? quantity.amount : null,
    paymentPreference: draft.data.payment,
    ...(originalDestination && draft.data.destination === (originalDestination.port || originalDestination.country) ? {deliveryCountry: originalDestination.country, ...(originalDestination.code ? {destinationCode: originalDestination.code} : {})} : {}),
    ...(draft.feed?.catalogProductId?{catalogProductId:draft.feed.catalogProductId,variants:draft.feed.variants?.length===1?[{...draft.feed.variants[0],containers:quantity.amount}]:draft.feed.variants}:{}),
    source: draft.feed ? 'PRODUCT_FEED' : 'AI_COMPOSER',
    sourceContext: draft.feed ? {...draft.feed, reviewedRequirement: draft.data} : {path: 'require'},
    knownFacts: {...draft.data, ...(draft.feed?.catalogProductId?{catalogProductId:draft.feed.catalogProductId,variants:draft.feed.variants?.length===1?[{...draft.feed.variants[0],containers:quantity.amount}]:draft.feed.variants}:{}), ...(draft.supplyPlan ? {supplyPlan: normalizeSupplyPlan(draft.supplyPlan, quantity)} : {}), notes: draft.notes.trim(), conversation: draft.messages.filter(x => x.role === 'user').map(x => x.text)},
  };
}
export function restoreComposerDraft(raw: string | null, ownerId?: string): ComposerDraft | null {
  try {
    const draft = JSON.parse(raw || 'null');
    if (draft?.version !== 2 || typeof draft.id !== 'string' || !draft.data || Array.isArray(draft.data) || (draft.ownerId && draft.ownerId !== ownerId)) return null;
    const data: RequirementData = {};
    for (const key of requirementFields) if (typeof draft.data[key] === 'string') data[key] = draft.data[key].slice(0,2000);
    return {...emptyComposerDraft(draft.id), ...(draft.composerVisited === true ? {composerVisited:true} : {}), data, ...(typeof draft.ownerId === 'string' ? {ownerId: draft.ownerId} : {}), feed: isFeedContext(draft.feed) ? draft.feed : null,
      messages: Array.isArray(draft.messages) ? draft.messages.filter((x: any) => ['user','assistant'].includes(x?.role) && typeof x.text === 'string').slice(-100).map((x: any) => ({role:x.role,text:x.text.slice(0,4000)})) : [],
      input: typeof draft.input === 'string' ? draft.input.slice(0,4000) : '', notes: typeof draft.notes === 'string' ? draft.notes.slice(0,8000) : '',
      ...(typeof draft.reorder?.transactionId === 'string' && typeof draft.reorder.unit === 'string' ? {reorder: {transactionId: draft.reorder.transactionId, unit: draft.reorder.unit, testOnly: Boolean(draft.reorder.testOnly)}} : {}),
      ...(draft.supplyPlan?.version === 1 && Array.isArray(draft.supplyPlan.batches) && draft.supplyPlan.batches.length >= 2 && draft.supplyPlan.batches.length <= 24 && draft.supplyPlan.batches.every((b: any) => b && typeof b.quantity === 'number' && typeof b.unit === 'string' && typeof b.plannedDate === 'string' && typeof b.notes === 'string') && typeof draft.supplyPlan.terms === 'string' && draft.supplyPlan.automaticPurchaseOrders === false ? {supplyPlan: draft.supplyPlan} : {}),
      ...(typeof draft.savedRequirementId === 'string' ? {savedRequirementId: draft.savedRequirementId} : {})};
  } catch { return null; }
}

// Values stay in their canonical (English) form for the platform; Arabic readers see them in Arabic.
const productAr: Record<string,string> = {'Semolina':'سميد','Sunflower Oil':'زيت عباد الشمس','Palm Oil':'زيت نخيل','Soybean Oil':'زيت صويا','Milk Powder':'حليب بودرة','Sugar':'سكر','Rice':'أرز','Tea':'شاي','Lentils':'عدس','Fava Beans':'فول','Yeast':'خميرة','Wheat':'قمح','Corn':'ذرة','Wheat Flour':'دقيق قمح','Whole Wheat Flour':'دقيق قمح كامل','Essential Flour':'دقيق أساسي','Pasta':'مكرونة','Tomato Paste':'صلصة طماطم','Sesame':'سمسم','Hibiscus':'كركديه','Gum Arabic':'صمغ عربي','Custom Packaging':'تغليف خاص','Biscuits':'بسكويت','Edible Oil':'زيت طعام'};
export function displayRequirementValue(field: RequirementField, value: string, lang: 'ar'|'en') {
  if (lang !== 'ar' || !value) return value;
  if (field === 'product') return productAr[value] || value;
  if (field === 'application') return value === 'Bakery' ? 'للمخابز' : value;
  if (field === 'quantity') {
    const q = quantityDetails(value);
    if (!q) return value;
    const n = q.amount.toLocaleString('en-US');
    return q.unit === 'FCL' ? (q.amount === 1 ? 'حاوية واحدة' : q.amount === 2 ? 'حاويتان' : n + (q.amount <= 10 ? ' حاويات' : ' حاوية')) : q.unit === 'KG' ? n + ' كجم' : n + ' طن';
  }
  if (field === 'packing') return value.replace(/^(\d+(?:[.,]\d+)?)\s*kg$/i, '$1 كجم').replace(/^(\d+(?:[.,]\d+)?)\s*L$/, '$1 لتر');
  if (field === 'payment') return value === 'L/C' ? 'L/C — اعتماد مستندي' : value === 'T/T' ? 'T/T — تحويل بنكي' : value === 'OTHER' ? 'تُناقش في العرض' : value;
  return value;
}

// Free-wording help from the interpret-requirement function only fills fields the buyer's own
// words left empty, and every value passes the same local checks as typed text.
const coreFields: RequirementField[] = ['product', 'quantity', 'destination'];
export function needsGuidance(draft: ComposerDraft) {
  return !draft.reorder && coreFields.some(field => !draft.data[field]);
}
export function applyGuidance(draft: ComposerDraft, fields: unknown, lang: 'ar' | 'en', submitted = '', aiReply = '', intent = 'request'): ComposerDraft {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || draft.reorder || draft.savedRequirementId) return draft;
  const given = fields as Record<string, unknown>;
  const known = (field: string) => {
    const value = typeof given[field] === 'string' ? (given[field] as string).trim() : '';
    return value && !/^(غير محدد|لا أعرف|غير معروف|unknown|null|n\/a|not specified)$/i.test(value) ? value.slice(0, 120) : '';
  };
  const raw = submitted.trim();
  const data: RequirementData = {...draft.data};
  let changed = false;
  // A question, complaint or chat that the local fallback kept as a field value is taken out again.
  if (raw && intent !== 'request') for (const field of Object.keys(data) as RequirementField[]) if (data[field] === raw) {delete data[field]; changed = true;}
  for (const field of ['product', 'quantity', 'destination', 'packing', 'incoterm', 'payment'] as RequirementField[]) {
    const value = known(field);
    // A field that only holds the buyer's whole sentence (the local fallback) may be corrected.
    if (!value || (data[field] && data[field] !== raw)) continue;
    const parsed = extractRequirement(value);
    const next = field === 'product' ? parsed.product || value
      : field === 'destination' ? parsed.destination || value
      : field === 'packing' ? parsed.packing || value
      : parsed[field];
    if (next) {data[field] = next; changed = true;}
  }
  const answer = aiReply.replace(/\s+/g, ' ').trim().slice(0, 400);
  if (!changed && !answer) return draft;
  const missing = missingRequirementFields(data);
  const question = missing.length ? requirementQuestion(missing[0], lang, draft.feed)
    : lang === 'ar' ? 'اكتملت الأساسيات. راجع ملخص الطلب وعدّل أي معلومة قبل إرساله لإعداد العرض.' : 'The essentials are complete. Review and correct the summary before sending it for an offer.';
  return {...draft, data, messages: [...draft.messages.slice(0, -1), {role: 'assistant' as const, text: answer ? answer + '\n\n' + question : question}]};
}

// A question (ends with ? or starts with a question word) is never kept as a field value.
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return /[?؟]\s*$/.test(t) || /^(?:هل|كم|متى|كيف|ليش|لماذا|لماذا|ليه|وين|أين|اين|ايش|إيش|شو|ماذا|ما هو|ما هي|من انتم|من أنتم|مين|فين|امتى|إمتى|what|how|when|why|where|who|do you|can you|is there|are you)\b/.test(t);
}

// Ask the AI whenever the buyer's own words were not clearly understood locally.
export function needsAI(before: ComposerDraft, after: ComposerDraft, text: string): boolean {
  if (smallTalk(text) || text.trim().length < 2 || before.reorder) return false;
  return needsGuidance(after) || looksLikeQuestion(text) || Object.keys(extractRequirement(text)).length === 0;
}
