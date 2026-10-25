'use client';

import {useMemo, useState} from 'react';
import Link from 'next/link';

/**
 * Unified entry point for internal work.
 * This screen deliberately does not persist commercial data or claim that
 * a natural-language instruction has been executed. All real mutations
 * must pass through authenticated server endpoints and human approval.
 */
type Mode = 'home' | 'product' | 'sector' | 'request';
const examples = [
  'أضف زيت عباد الشمس زولانا، عبوات 1 لتر و5 لتر',
  'أنشئ قطاع مواد البناء وتصنيف الأسمنت',
  'راجع الطلبات التي تنتظر التقييم',
];

function classify(value: string): Mode {
  const text = value.trim();
  if (!text) return 'home';
  if (/قطاع|تصنيف|فئة|قسم/.test(text)) return 'sector';
  if (/طلب|عميل|عرض سعر|صفقة|توريد/.test(text) && !/أضف منتج|منتج جديد/.test(text)) return 'request';
  if (/منتج|أضف|عبوة|عبوات|كتالوج|صنف|زيت|دقيق/.test(text)) return 'product';
  return 'home';
}

export default function CommandCenter() {
  const [instruction, setInstruction] = useState('');
  const [review, setReview] = useState(false);
  const mode = useMemo(() => classify(instruction), [instruction]);
  const links = [
    {href:'/demand-intelligence', title:'الفرص والتقييم', description:'متابعة فرص الطلب والتحقق قبل الالتزام'},
    {href:'/requests', title:'الطلبات', description:'فتح الطلبات الموجودة ومتابعة حالتها'},
    {href:'/discover', title:'كتالوج العملاء', description:'معاينة ما يراه العميل في اكتشف'},
  ];
  return <main dir="rtl" style={{minHeight:'100dvh',background:'#06172d',color:'#f3f7ff',fontFamily:'inherit',padding:'clamp(16px,4vw,40px)'}}>
    <div style={{maxWidth:900,margin:'0 auto',display:'flex',flexDirection:'column',gap:22}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div><strong style={{letterSpacing:2,fontSize:19}}>SEPTLION</strong><div style={{color:'#a5b6cd',fontSize:12}}>مركز القيادة · معاينة أولية</div></div>
        <Link href="/" style={{color:'#d6e6f9',textDecoration:'none'}}>الرئيسية ←</Link>
      </header>
      <section style={{padding:'clamp(20px,4vw,38px)',background:'#102740',border:'1px solid #29415d',borderRadius:22}}>
        <p style={{color:'#aac2d9',fontSize:13}}>إدارة العمل دون نماذج طويلة</p>
        <h1 style={{fontSize:'clamp(25px,5vw,38px)',lineHeight:1.5,margin:'8px 0 20px'}}>ماذا تريد أن تنجز؟</h1>
        <label htmlFor="command" style={{display:'block',marginBottom:10,color:'#d5e2ef'}}>اكتب المهمة بلغتك</label>
        <textarea id="command" value={instruction} onChange={e=>{setInstruction(e.target.value);setReview(false)}} placeholder="مثال: أضف زيت عباد الشمس عبوة 1 لتر و5 لتر..." maxLength={3000} rows={3} style={{width:'100%',boxSizing:'border-box',borderRadius:14,border:'1px solid #46607a',background:'#091c32',color:'#fff',padding:16,font:'inherit',resize:'vertical'}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginTop:15,flexWrap:'wrap'}}>
          <small style={{color:'#a5b6cd'}}>لا يتم حفظ أو نشر أي بيانات دون اعتماد.</small>
          <button type="button" disabled={!instruction.trim()} onClick={()=>setReview(true)} style={{background:'#e5c487',border:0,color:'#172235',padding:'12px 23px',borderRadius:12,fontWeight:700,cursor:'pointer',opacity:instruction.trim()?1:.5}}>مراجعة المهمة</button>
        </div>
        {review && <div role="status" style={{marginTop:20,padding:18,borderRadius:14,background:'#172f4a',border:'1px solid #41617e'}}>
          <strong>مراجعة قبل التنفيذ</strong>
          <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{instruction}</p>
          <p style={{color:'#c3d4e4'}}>التصنيف المقترح: {mode==='product'?'منتج أو كتالوج':mode==='sector'?'قطاع أو تصنيف':mode==='request'?'طلبات وعمليات':'يحتاج توضيحًا'}</p>
          <p style={{color:'#e5c487',fontSize:13}}>هذه معاينة فقط. لم يُنشأ سجل ولم يُنشر منتج. يجب ربط الاعتماد بواجهة خادم تتحقق من صلاحيات المسؤول والبيانات.</p>
        </div>}
      </section>
      <section aria-label="مهام سريعة">
        <h2 style={{fontSize:16,marginBottom:12}}>ابدأ بسرعة</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:10}}>
          {examples.map(x=><button key={x} onClick={()=>{setInstruction(x);setReview(false)}} style={{textAlign:'right',padding:15,borderRadius:14,border:'1px solid #29415d',background:'#102740',color:'#e8f0fa',font:'inherit',cursor:'pointer'}}>{x}</button>)}
        </div>
      </section>
      <section aria-label="مساحات العمل">
        <h2 style={{fontSize:16,marginBottom:12}}>مساحات العمل الحالية</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:12}}>
          {links.map(item=><Link key={item.href} href={item.href} style={{textDecoration:'none',color:'inherit',padding:18,background:'#102740',border:'1px solid #29415d',borderRadius:15}}><strong>{item.title}</strong><p style={{color:'#aec3d7',fontSize:13,lineHeight:1.7}}>{item.description}</p><span style={{color:'#e5c487',fontSize:13}}>فتح المساحة ←</span></Link>)}
        </div>
      </section>
      <footer style={{fontSize:12,color:'#9cb1c7',paddingBottom:15}}>هذه نقطة دخول موحدة تدريجية؛ الصلاحيات وعمليات الحفظ يجب أن تُفرض على الخادم، وليس من الواجهة فقط.</footer>
    </div>
  </main>;
}
