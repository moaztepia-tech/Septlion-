'use client';
import {OpsFrame} from '../../components/ops-console';
export default function CommandAccess({busy,error,onEnter}:{busy:boolean;error?:string;onEnter:()=>void}) {
 return <OpsFrame active="home"><section className="ops-card" style={{maxWidth:520,margin:'8vh auto 0',textAlign:'center'}}>
  <h1 className="ops-h1">لوحة فريق سبتليون</h1>
  <p className="ops-sub">{busy?'نتحقق من حسابك…':'سجّل الدخول بحساب الفريق للمتابعة.'}</p>
  <div className="ops-actions" style={{justifyContent:'center',marginTop:16}}>
   <a className="ops-btn pri" href="/account?next=/command-center">تسجيل الدخول</a>
   <button className="ops-btn" disabled={busy} onClick={onEnter}>{busy?'جارٍ التحقق…':'لقد سجّلت الدخول'}</button>
  </div>
  {error&&<p className="ops-alert" role="alert" style={{marginTop:12}}>{error}</p>}
 </section></OpsFrame>;
}
