export const DOCUMENT_BUCKET='trade-documents';
export const MAX_DOCUMENT_BYTES=10*1024*1024;
export const DOCUMENT_MIMES=['application/pdf','image/png','image/jpeg'];
export const DOCUMENT_KINDS=['INVOICE','PACKING_LIST','BILL_OF_LADING','QUALITY_REPORT','DELIVERY_PROOF','OTHER'];
export function documentInput(body:Record<string,unknown>) {
 const fileName=typeof body.fileName==='string'?body.fileName.trim():'';
 const mimeType=String(body.mimeType||'');const byteSize=body.byteSize;
 const sha256=String(body.sha256||'').toLowerCase();const kind=String(body.kind||'OTHER');
 const key=String(body.idempotencyKey||'');
 if(!fileName||fileName.length>180||/[\x00-\x1f\x7f/\\]/.test(fileName)||fileName==='.'||fileName==='..')throw new Error('اسم الملف غير صالح');
 if(!DOCUMENT_MIMES.includes(mimeType))throw new Error('الأنواع المسموحة: PDF وPNG وJPEG');
 const extensions:Record<string,RegExp>={'application/pdf':/\.pdf$/i,'image/png':/\.png$/i,'image/jpeg':/\.jpe?g$/i};
 if(!extensions[mimeType].test(fileName))throw new Error('امتداد الملف لا يتطابق مع نوعه');
 if(typeof byteSize!=='number'||!Number.isSafeInteger(byteSize)||byteSize<1||byteSize>MAX_DOCUMENT_BYTES)throw new Error('الحد الأقصى للملف 10 ميجابايت');
 if(!/^[a-f0-9]{64}$/.test(sha256))throw new Error('بصمة الملف غير صالحة');
 if(!DOCUMENT_KINDS.includes(kind))throw new Error('نوع المستند غير صالح');
 if(!/^[a-zA-Z0-9_-]{12,100}$/.test(key))throw new Error('مفتاح رفع الملف غير صالح');
 if(typeof body.visibilityToCounterparty!=='boolean')throw new Error('حدد صلاحية إظهار المستند للطرف الآخر');
 return {fileName,mimeType,byteSize,sha256,kind,key,visibility:body.visibilityToCounterparty};
}
export async function checkDocumentBytes(bytes:Uint8Array,mimeType:string,expectedSize:number,expectedHash:string) {
 const pdf=bytes.length>=8&&new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-'&&new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF');
 const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
 const jpeg=bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(bytes.length!==expectedSize||bytes.length>MAX_DOCUMENT_BYTES||!({'application/pdf':pdf,'image/png':png,'image/jpeg':jpeg} as Record<string,boolean>)[mimeType])throw new Error('محتوى الملف أو حجمه لا يطابق بيانات الرفع');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==expectedHash)throw new Error('بصمة محتوى الملف لا تطابق الملف المحدد');return hash;
}
