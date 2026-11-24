import Link from 'next/link';
import {OpsFrame} from '../../components/ops-console';
import DemandRadar from './DemandRadar';

const pipeline=['رصد الطلب','استخراج المتطلبات','تحديد المشتري','تأهيل الفرصة','بناء عرض دقيق','جذب طلبات مشابهة','تحويله إلى طلب عرض سعر'];

export const metadata={title:'رادار الطلب — مناقصات وطلبات عروض أسعار | سبتليون',description:'رادار سبتليون يرصد المناقصات وطلبات عروض الأسعار في الأسواق، ويؤهلها ويحوّلها إلى فرص توريد قابلة للتنفيذ.'};

export default function DemandIntelligence(){
 return <OpsFrame active="radar">
  <div>
   <h1 className="ops-h1" id="radar">رادار الطلب</h1>
   <p className="ops-sub">طلبات شراء ومناقصات حقيقية يرصدها النظام تلقائيًا من الأسواق كل 6 ساعات. كل إشارة تُعامل كفرصة محتملة حتى يتم التحقق منها.</p>
  </div>
  <DemandRadar/>
  <details className="ops-card ops-fold">
   <summary><span><b className="ops-h2">كيف يعمل الرادار؟</b><br/><small className="ops-sub">من رصد الطلب إلى طلب عرض سعر</small></span></summary>
   <ol className="ops-steps">{pipeline.map((x,i)=><li key={x}><span>{i+1}</span>{x}</li>)}</ol>
   <div className="ops-tiles" style={{marginTop:14}}>
    <div className="ops-tile"><b>تحليل الطلب</b><small>نفصل المنتج والمواصفة والكمية والوجهة والموعد النهائي والمشتري والدليل في حقول يمكن التحقق منها.</small></div>
    <div className="ops-tile"><b>جاهزية العرض</b><small>الأهلية ومسار التوريد والمصنع المناسب والمستندات وشروط التسليم والقيود التجارية تتحول إلى ملخص قرار.</small></div>
    <div className="ops-tile"><b>صفحات الطلب</b><small>نجمع الطلبات المتشابهة في صفحات منتج وسوق قابلة للبحث، مع رابط مباشر لطلب عرض سعر، دون كشف هوية المشترين.</small><Link href="/demand/" className="ops-link">فتح صفحات الطلب ←</Link></div>
   </div>
   <p className="ops-sub" style={{marginTop:14}}>نبدأ بمنتج واحد: الدقيق. مناقصات الدقيق وطلبات الشراء التجارية والطلبات المتكررة، ثم نتوسع إلى منتجات أخرى.</p>
  </details>
  <div className="ops-row"><p className="ops-sub">السوق يخبرنا بما يجب أن نبنيه.</p><Link href="/require" className="ops-btn pri">ابدأ طلبًا</Link></div>
 </OpsFrame>;
}
