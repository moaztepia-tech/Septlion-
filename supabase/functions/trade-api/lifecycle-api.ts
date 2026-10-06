import { advanceInput, expectedVersion, reorderInput, textValue, actionKey, NEXT_STAGE, rpcStatus } from './lifecycle-input.ts';
import { documentInput, checkDocumentBytes, DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, DOCUMENT_MIMES } from './document-input.ts';

type Context = { db:any; admin:any; userId:string; buyerOrgId:string; operator:boolean; out:(body:unknown,status?:number)=>Response };
const messages:Record<string,string>={
 offer_expired:'انتهت صلاحية العرض. اطلب نسخة محدثة.',revision_changed:'تغيرت نسخة العرض. حدّث الصفحة قبل المتابعة.',
 acceptance_mode_invalid:'وضع التأكيد لا يتطابق مع نوع العرض.',stale_transaction:'تغيرت الصفقة أثناء العمل. حدّث بياناتها ثم أعد المحاولة.',
 idempotency_conflict:'استُخدم مفتاح العملية ببيانات مختلفة. حدّث الصفحة قبل إنشاء عملية جديدة.',
 invalid_status_transition:'هذا الانتقال غير متاح من الحالة الحالية.',milestone_mismatch:'مرحلة التنفيذ لا تطابق الحالة.',
 claim_pending:'يجب معالجة المطالبة المفتوحة قبل تأكيد الاستلام.',claim_already_open:'توجد مطالبة مفتوحة لهذه الصفقة.',
 receipt_not_available:'تأكيد الاستلام غير متاح قبل تسجيل التسليم.',reorder_not_available:'إعادة الطلب متاحة بعد اكتمال الصفقة.',
 shipping_evidence_required:'ارفع بوليصة الشحن وشاركها مع المشتري قبل تسجيل الشحن.',delivery_evidence_required:'ارفع إثبات التسليم وشاركه مع المشتري قبل تسجيل التسليم.',
 transaction_not_found:'لم نجد صفقة متاحة لحسابك.',document_not_found:'المستند غير متاح لحسابك.',actor_not_active:'الحساب أو المؤسسة غير نشط.',access_denied:'لا تملك صلاحية هذه العملية.'
};
function rpcError(c:Context,error:{message:string}) { const key=Object.keys(messages).find(k=>error.message.includes(k));return c.out({error:key?messages[key]:'تعذر تنفيذ العملية. راجع بياناتها وحالة الصفقة.'},rpcStatus(error.message)); }
function checked(result:any) { if(result.error)throw new Error('تعذر قراءة بيانات الصفقة. حاول مجددًا.');return result.data; }

export async function handleLifecycle(action:string,body:Record<string,unknown>,c:Context):Promise<Response|null> {
 const {db,admin,userId,buyerOrgId,operator,out}=c;
 const supported=new Set(['operator.transaction','offers.accept','transactions.get','transactions.list','transactions.advance','receipt.accept','claims.open','claims.resolve','reorder.create','documents.prepare','documents.complete','documents.list','documents.download']);
 if(!supported.has(action))return null;
 const side=body.side===undefined?'BUYER':body.side;
 if(side!=='BUYER'&&side!=='OPERATOR')return out({error:'جهة الوصول غير صالحة'},400);
 const isOp=action==='operator.transaction'||action==='transactions.advance'||action==='claims.resolve'||side==='OPERATOR';
 if(isOp&&!operator)return out({error:'هذه العملية متاحة لفريق العمليات فقط'},403);
 const orgId=isOp?'septlion-operator':buyerOrgId;
 async function transaction(id:unknown) {
  return checked(await db.from('TradeTransaction').select('*').eq('id',String(id||'')).eq(isOp?'supplierOrgId':'buyerOrgId',orgId).maybeSingle());
 }
 if(action==='offers.accept') {
  if(body.mode!=='TEST'&&body.mode!=='COMMERCIAL')return out({error:'حدد وضع التأكيد'},400);
  const revision=expectedVersion(body.revision);
  const r=await db.rpc('accept_trade_offer_v2',{p_offer_id:String(body.offerId||''),p_buyer_org_id:buyerOrgId,p_user_id:userId,p_revision:revision,p_mode:body.mode});
  return r.error?rpcError(c,r.error):out(r.data);
 }
 if(action==='transactions.list')return out({items:checked(await db.from('TradeTransaction').select('id,reference,status,testOnly,version,createdAt,updatedAt').eq('buyerOrgId',buyerOrgId).order('updatedAt',{ascending:false}).limit(100))||[]});
 if(action==='transactions.get'||action==='operator.transaction') {
  const tx=await transaction(body.id);if(!tx)return out({error:messages.transaction_not_found},404);
  const milestoneQuery=db.from('TradeMilestone').select('code,label,status,sequence,completedAt,buyerVisible').eq('transactionId',tx.id);
  const eventQuery=db.from('TradeEvent').select('id,sequence,type,occurredAt,payload,visibility,actorOrgId').eq('transactionId',tx.id);
  const results=await Promise.all([
   (isOp?milestoneQuery:milestoneQuery.eq('buyerVisible',true)).order('sequence'),
   db.from('TradeReceipt').select('id,status,confirmedAt,notes').eq('transactionId',tx.id).maybeSingle(),
   (isOp?eventQuery:eventQuery.in('visibility',['BUYER'])).order('sequence').limit(200),
   db.from('CommercialLock').select('id,lockedAt,snapshotHash,snapshot,offerId').eq('id',tx.commercialLockId).maybeSingle(),
   db.from('TradeClaim').select('id,status,description,resolution,createdAt,resolvedAt').eq('transactionId',tx.id).order('createdAt',{ascending:false}).limit(100)
  ]);
  const [milestones,receipt,events,lock,claims]=results.map(checked);
  // Buyer workspaces never receive procurement evidence stored in the lock.
  const commercialLock=lock?{id:lock.id,lockedAt:lock.lockedAt,snapshotHash:lock.snapshotHash,offerId:lock.offerId,snapshot:{items:lock.snapshot?.items||[],terms:lock.snapshot?.terms||{},testOnly:tx.testOnly}}:null;
  return out({item:tx,commercialLock,milestones:milestones||[],receipt,events:(events||[]).filter((e:any)=>e.visibility!=='INTERNAL'||e.actorOrgId===orgId).map((e:any)=>({id:e.id,sequence:e.sequence,type:e.type,occurredAt:e.occurredAt,payload:{input:e.payload?.input?{note:e.payload.input.note}:undefined,note:e.payload?.note,description:e.payload?.description,fileName:e.payload?.fileName}})),claims:claims||[],nextAction:NEXT_STAGE[tx.status]||null});
 }
 if(action==='transactions.advance') {
  const tx=await transaction(body.transactionId);if(!tx)return out({error:messages.transaction_not_found},404);
  const x=advanceInput(body,tx.status),r=await db.rpc('advance_trade_transaction_v2',{p_transaction_id:tx.id,p_status:x.status,p_milestone_code:x.milestoneCode,p_user_id:userId,p_expected_version:x.expectedVersion,p_key:x.key,p_note:x.note});
  return r.error?rpcError(c,r.error):out(r.data);
 }
 if(['receipt.accept','claims.open','claims.resolve','reorder.create'].includes(action)) {
  const tx=await transaction(body.transactionId);if(!tx)return out({error:messages.transaction_not_found},404);
  const base={p_transaction_id:tx.id,p_user_id:userId};let name='',args:Record<string,unknown>={};
  if(action==='receipt.accept'){name='accept_trade_receipt_v2';args={...base,p_buyer_org_id:buyerOrgId,p_expected_version:expectedVersion(body.expectedVersion)};}
  if(action==='claims.open'){name='open_trade_claim_v2';args={...base,p_buyer_org_id:buyerOrgId,p_description:textValue(body.description,5,2000,'صف المشكلة في 5 إلى 2000 حرف'),p_expected_version:expectedVersion(body.expectedVersion),p_key:actionKey(body.idempotencyKey)};}
  if(action==='claims.resolve'){name='resolve_trade_claim_v2';args={...base,p_claim_id:String(body.claimId||''),p_note:textValue(body.note,5,2000,'أضف وصفًا لمعالجة المطالبة'),p_expected_version:expectedVersion(body.expectedVersion)};}
  if(action==='reorder.create') {
   const lock=checked(await db.from('CommercialLock').select('offerId').eq('id',tx.commercialLockId).single());
   const offer=checked(await db.from('SeptlionOffer').select('requirementId').eq('id',lock.offerId).single());
   const requirement=checked(await db.from('QualifiedRequirement').select('unit').eq('id',offer.requirementId).single());
   const x=reorderInput(body,requirement.unit);name='reorder_trade_transaction_v2';args={...base,p_buyer_org_id:buyerOrgId,p_quantity:x.quantity,p_key:x.key};
  }
  const r=await db.rpc(name,args);return r.error?rpcError(c,r.error):out(r.data,r.data?.idempotent?200:action==='claims.open'||action==='reorder.create'?201:200);
 }
 async function document(id:unknown) {
  const row=checked(await db.from('CommercialDocument').select('*').eq('id',String(id||'')).eq('entityType','TRANSACTION').maybeSingle());
  if(!row)return null;const tx=await transaction(row.entityId);if(!tx)return null;
  const party=row.organizationId===tx.buyerOrgId||row.organizationId===tx.supplierOrgId;
  return party&&(row.organizationId===orgId||row.visibilityToCounterparty===true)?row:null;
 }
 if(action==='documents.list') {
  const tx=await transaction(body.transactionId||body.entityId);if(!tx)return out({error:messages.transaction_not_found},404);
  const rows=checked(await db.from('CommercialDocument').select('id,organizationId,fileName,mimeType,byteSize,kind,status,visibilityToCounterparty,createdAt').eq('entityType','TRANSACTION').eq('entityId',tx.id).in('organizationId',[tx.buyerOrgId,tx.supplierOrgId]).eq('status','READY').order('createdAt',{ascending:false}).limit(200))||[];
  return out({items:rows.filter((d:any)=>d.organizationId===orgId||d.visibilityToCounterparty===true).map((d:any)=>({id:d.id,fileName:d.fileName,mimeType:d.mimeType,byteSize:d.byteSize,kind:d.kind,status:d.status,visibilityToCounterparty:d.visibilityToCounterparty,createdAt:d.createdAt,own:d.organizationId===orgId}))});
 }
 if(action==='documents.prepare') {
  const tx=await transaction(body.transactionId);if(!tx)return out({error:messages.transaction_not_found},404);
  const x=documentInput(body),r=await db.rpc('prepare_trade_document',{p_transaction_id:tx.id,p_org_id:orgId,p_user_id:userId,p_file_name:x.fileName,p_mime:x.mimeType,p_size:x.byteSize,p_sha:x.sha256,p_kind:x.kind,p_visibility:x.visibility,p_key:x.key});
  if(r.error)return rpcError(c,r.error);
  const d=r.data;if(d.status==='READY')return out({documentId:d.id,status:'READY',idempotent:true});
  const bucket=await admin.storage.getBucket(DOCUMENT_BUCKET);
  if(bucket.error) {
   if(!/not found/i.test(bucket.error.message))return out({error:'تعذر الوصول إلى مساحة المستندات مؤقتًا'},503);
   const created=await admin.storage.createBucket(DOCUMENT_BUCKET,{public:false,fileSizeLimit:MAX_DOCUMENT_BYTES,allowedMimeTypes:DOCUMENT_MIMES});
   if(created.error&&!/already exists/i.test(created.error.message))return out({error:'تعذر تجهيز مساحة المستندات مؤقتًا'},503);
  } else if(bucket.data?.public)return out({error:'إعدادات خصوصية المستندات تحتاج إلى مراجعة'},503);
  const signed=await admin.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(d.storageKey,{upsert:false});
  if(signed.error)return out({error:'تعذر تجهيز رابط الرفع مؤقتًا. أعد المحاولة بنفس الملف.'},503);
  return out({documentId:d.id,status:'PENDING',uploadUrl:signed.data.signedUrl},201);
 }
 if(action==='documents.complete') {
  const d=await document(body.documentId);if(!d||d.organizationId!==orgId||d.uploadedById!==userId)return out({error:messages.document_not_found},404);
  if(d.status==='READY')return out({documentId:d.id,status:'READY',idempotent:true});
  if(d.status!=='PENDING')return out({error:'تعذر اعتماد هذا الملف. اختر الملف مجددًا لإنشاء رفع جديد.'},409);
  const downloaded=await admin.storage.from(DOCUMENT_BUCKET).download(d.storageKey);
  if(downloaded.error)return out({error:'لم يكتمل رفع الملف. أعد المحاولة بنفس الملف.'},409);
  let valid=true;try{if(downloaded.data.size>MAX_DOCUMENT_BYTES)throw new Error('size');await checkDocumentBytes(new Uint8Array(await downloaded.data.arrayBuffer()),d.mimeType,Number(d.byteSize),d.sha256);}catch{valid=false;}
  const r=await db.rpc('finalize_trade_document',{p_document_id:d.id,p_org_id:orgId,p_user_id:userId,p_valid:valid});
  if(r.error)return rpcError(c,r.error);
  return valid?out(r.data):out({error:'محتوى الملف لا يطابق بياناته، فتم عزله. اختر ملفًا صالحًا.'},400);
 }
 if(action==='documents.download') {
  const d=await document(body.documentId);if(!d||d.status!=='READY')return out({error:messages.document_not_found},404);
  const signed=await admin.storage.from(DOCUMENT_BUCKET).createSignedUrl(d.storageKey,60,{download:d.fileName});
  if(signed.error)return out({error:'تعذر تنزيل الملف مؤقتًا'},503);
  return out({url:signed.data.signedUrl,fileName:d.fileName,expiresIn:60});
 }
 return null;
}
