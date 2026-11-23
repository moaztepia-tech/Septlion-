'use client';
export default function CommandAccess({busy,error,onEnter}:{busy:boolean;error?:string;onEnter:()=>void}) {
 return <main dir="rtl" className="buyer-section"><h1>الدخول إلى مركز القيادة</h1><p>تحقق من حسابك التشغيلي للمتابعة.</p><button className="primary-link" disabled={busy} onClick={onEnter}>{busy?'جارٍ التحقق…':'متابعة بالحساب الحالي'}</button> <a href="/account?next=/command-center">تسجيل الدخول</a>{error&&<p role="alert">{error}</p>}</main>;
}
