'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {BuyerShell} from '../../components/buyer-shell';
import {DesignLink, DesignCard, DesignButton} from '../../components/design-system';
import {catalogPreview} from '../../lib/catalog-preview';
import {COMPOSER_DRAFT_KEY, emptyComposerDraft} from '../../lib/composer-draft';
import {sessionUserId} from '../../lib/api';

export default function ProductDetails() {
  const router = useRouter();
  const [product, setProduct] = useState<(typeof catalogPreview)[number] | null>(null);
  const [pack, setPack] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {const id = new URLSearchParams(window.location.search).get('id'); setProduct(catalogPreview.find(item => item.id === id) || null);}, []);
  function start() {
    if (!product) return;
    try {
      const draft = {...emptyComposerDraft(crypto.randomUUID()), ownerId:sessionUserId(), data:{product:product.en, ...(product.id === 'flour-bakery' ? {application:'Bakery'} : {}), ...(pack ? {packing:pack} : {})}};
      sessionStorage.setItem(COMPOSER_DRAFT_KEY, JSON.stringify(draft));
      for (const key of ['septlion_feed_context','septlion_requirement_seed','septlion_requirement_context','septlion_pending_requirement']) sessionStorage.removeItem(key);
      router.push('/require');
    } catch {setError('تعذر حفظ اختيارك. يمكنك البدء من محرّر الطلب.');}
  }
  return <BuyerShell title="تفاصيل المنتج"><section className="buyer-section">
    <a href="/discover" className="back-link">← اكتشف المنتجات</a>
    {!product ? <div className="empty-state"><h1>اختر منتجًا من «اكتشف»</h1><p>تفاصيل المنتجات المنشورة تظهر هنا.</p><DesignLink className="primary-link" href="/discover">فتح اكتشف</DesignLink></div> : <>
      <DesignCard className="product-detail-card"><div className="product-detail-mark"><span lang="en">ZOLLANA</span><h1>{product.name}</h1><p lang="en" dir="ltr">{product.en}</p></div><dl className="detail-list"><div><dt>التعبئات المتاحة</dt><dd>{product.pack}</dd></div><div><dt>المواصفة</dt><dd>{product.note}</dd></div></dl><p>نراجع الكمية والوجهة والتعبئة معك، ثم نثبت السعر والتوفر وموعد التوريد في عرض Septlion.</p></DesignCard>
      <DesignCard><h2>اختر التعبئة</h2><p>يمكنك تأجيل اختيار التعبئة ومناقشتها داخل محرّر الطلب.</p><div className="pack-options">{product.pack.split(' · ').map(size => <DesignButton key={size} aria-pressed={pack === size} className={pack === size ? 'selected' : 'secondary'} onClick={() => setPack(size)}>{size}</DesignButton>)}</div><DesignButton onClick={start}>أكمل في محرّر الطلب ←</DesignButton>{error && <p role="alert">{error}</p>}</DesignCard>
    </>}
  </section></BuyerShell>;
}
