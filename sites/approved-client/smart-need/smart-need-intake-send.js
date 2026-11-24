const SMART_ENDPOINT='https://septlion-web-production.up.railway.app/api/interpret-requirement';
let smartSerial=0;
function send(text){
  const t=String(text??input.value).trim().slice(0,2000);if(!t)return;
  const serial=++smartSerial;
  input.value='';input.style.height='';input.placeholder='اكتب احتياجك أو أي تعديل...';$('#welcome')?.remove();$('#samples')?.remove();clearNeedContext(true);addMsg(t,'user');
  const result=Intake.consume(needDraft,t,PRODUCTS);needDraft=result.draft;S.needText=needDraft.fields.product?Intake.summary(needDraft):'';renderNeedContext(result);
  if(t.length<3)return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
  void fetch(SMART_ENDPOINT,{method:'POST',mode:'cors',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({text:needDraft.messages.slice(-10).join('\n').slice(-3900)})})
    .then(async r=>{if(!r.ok)throw Error('unavailable');return r.json()})
    .then(data=>{
      if(serial!==smartSerial||!data||typeof data.result!=='string'||!data.fields||typeof data.fields!=='object')return;
      const mapping={product:'product',quantity:'quantity',destination:'destination',packing:'packaging',incoterm:'incoterm',payment:'payment'};
      let changed=false;
      for(const [remote,local] of Object.entries(mapping)){
        const val=data.fields[remote];
        if(typeof val!=='string'||!val.trim()||/^(?:unknown|غير محدد|لا أعرف|null)$/i.test(val.trim()))continue;
        if(!needDraft.fields[local]){needDraft.fields[local]=val.trim().slice(0,180);needDraft.skipped=needDraft.skipped.filter(key=>key!==local);changed=true;}
      }
      const updated=Intake.consume(needDraft,'',PRODUCTS);
      if(changed){needDraft.pending=updated.question?.key||null;S.needText=needDraft.fields.product?Intake.summary(needDraft):'';}
      renderNeedContext({...updated,reply:data.result.trim().slice(0,1000)||updated.reply});
    }).catch(()=>{}).finally(()=>clearTimeout(timer));
}
