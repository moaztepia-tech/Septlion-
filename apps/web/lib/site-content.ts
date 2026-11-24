'use client';
import {useEffect, useState} from 'react';
import baked from './site-content.generated.json';

// Every text the team can change from "محتوى الموقع". The default is what the
// page shows when nothing was saved; an empty save brings it back.
export type ContentField = {key: string; label: string; def: string; long?: boolean};
export type ContentSection = {id: string; title: string; page: string; fields: ContentField[]};

export const CONTENT: ContentSection[] = [
 {id: 'home-hero', title: 'الواجهة الرئيسية', page: '/', fields: [
  {key: 'home.overline', label: 'السطر الصغير أعلى الصفحة', def: 'SEPTLION / GLOBAL TRADE OPERATING SYSTEM'},
  {key: 'home.kicker', label: 'الشارة فوق العنوان', def: 'التجارة العالمية، بطريقة مختلفة'},
  {key: 'home.title1', label: 'العنوان — السطر الأول', def: 'طموحك التجاري.'},
  {key: 'home.title2', label: 'العنوان — السطر الثاني (بلون مختلف)', def: 'مسؤوليتنا أن يتحقق.'},
  {key: 'home.lead', label: 'الفقرة تحت العنوان', def: 'أخبرنا بما تريد شراءه أو تصنيعه أو توريده. ننسّق الإمكانات ونحوّل احتياجك إلى مسار تجاري واضح — من الطلب إلى التنفيذ.', long: true},
  {key: 'home.step1', label: 'الخطوة 1', def: 'عبّر عن احتياجك'},
  {key: 'home.step2', label: 'الخطوة 2', def: 'نجهّز الحل'},
  {key: 'home.step3', label: 'الخطوة 3', def: 'ننفّذ معك'},
 ]},
 {id: 'home-form', title: 'مربع الطلب في الصفحة الرئيسية', page: '/', fields: [
  {key: 'home.panel.title', label: 'عنوان المربع', def: 'مساحة الطلب الذكي'},
  {key: 'home.panel.badge', label: 'الشارة الخضراء', def: 'جاهز لاستقبال طلبك'},
  {key: 'home.form.label', label: 'السؤال', def: 'ما الذي تريد إنجازه؟'},
  {key: 'home.form.hint', label: 'الشرح تحت السؤال', def: 'اكتب بلغتك وبطريقتك. لا تحتاج إلى تجهيز مواصفات كاملة الآن.', long: true},
  {key: 'home.form.placeholder', label: 'المثال داخل المربع', def: 'مثال: أحتاج 5 حاويات دقيق قمح إلى تنزانيا، التسليم CIF والدفع باعتماد مستندي…', long: true},
  {key: 'home.form.button', label: 'زر الإرسال', def: 'ابدأ طلبك'},
  {key: 'home.examples.title', label: 'عنوان الأمثلة', def: 'أمثلة للبدء'},
  {key: 'home.example1', label: 'مثال 1', def: 'أحتاج 3 حاويات دقيق إلى دار السلام'},
  {key: 'home.example2', label: 'مثال 2', def: 'أريد تصنيع عبوات لعلامتي التجارية'},
  {key: 'home.example3', label: 'مثال 3', def: 'أبحث عن مورد لتغليف منتجات غذائية'},
 ]},
 {id: 'home-cards', title: 'البطاقات الثلاث أسفل الصفحة الرئيسية', page: '/', fields: [
  {key: 'home.card1.title', label: 'البطاقة 1 — العنوان', def: 'اكتشف الإمكانات'},
  {key: 'home.card1.text', label: 'البطاقة 1 — النص', def: 'استعرض منتجات وعروضًا مؤهلة، أو ابدأ مباشرة باحتياجك.', long: true},
  {key: 'home.card1.link', label: 'البطاقة 1 — الرابط', def: 'استكشف المنتجات'},
  {key: 'home.card2.title', label: 'البطاقة 2 — العنوان', def: 'احتياجك أولًا'},
  {key: 'home.card2.text', label: 'البطاقة 2 — النص', def: 'نحوّل التفاصيل غير المكتملة إلى طلب تجاري قابل للتسعير والتنفيذ.', long: true},
  {key: 'home.card2.link', label: 'البطاقة 2 — الرابط', def: 'قدّم احتياجك'},
  {key: 'home.card3.title', label: 'البطاقة 3 — العنوان', def: 'من الوعد إلى التنفيذ'},
  {key: 'home.card3.text', label: 'البطاقة 3 — النص', def: 'تابع الطلبات والعروض ومراحل التنفيذ في مساحة واحدة.', long: true},
  {key: 'home.card3.link', label: 'البطاقة 3 — الرابط', def: 'مساحتي'},
 ]},
 {id: 'footer', title: 'أسفل الصفحة', page: '/', fields: [
  {key: 'home.footer1', label: 'الشعار', def: 'Master Steps. Shorten Distances.'},
  {key: 'home.footer2', label: 'السطر الثاني', def: 'Built for ambitious trade.'},
 ]},
];

const DEFAULTS: Record<string, string> = Object.fromEntries(CONTENT.flatMap(s => s.fields.map(f => [f.key, f.def])));
const CACHE = 'septlion_site_content';
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

export async function fetchSiteContent(): Promise<Record<string, string>> {
 if (!URL_BASE || !KEY) return {};
 const r = await fetch(`${URL_BASE}/rest/v1/SiteContent?select=key,value`, {headers: {apikey: KEY}, cache: 'no-store'});
 if (!r.ok) throw new Error('تعذر تحميل محتوى الموقع');
 const rows = await r.json() as {key: string; value: string}[];
 return Object.fromEntries(rows.map(x => [x.key, x.value]));
}

// Texts baked in at build time, then the latest saved texts, so an edit shows
// on the next page load without waiting for a new release.
export function useSiteText() {
 const [saved, setSaved] = useState<Record<string, string>>(baked as Record<string, string>);
 useEffect(() => {
  try { const c = localStorage.getItem(CACHE); if (c) setSaved(JSON.parse(c)); } catch { /* cache is optional */ }
  fetchSiteContent().then(v => { setSaved(v); try { localStorage.setItem(CACHE, JSON.stringify(v)); } catch { /* optional */ } }).catch(() => { /* keep built-in texts */ });
 }, []);
 return (key: string) => saved[key] || DEFAULTS[key] || '';
}
