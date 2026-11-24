// Only the Auth server's verified user is evidence; never user_metadata or a UI flag.
// A buyer proves ownership of either the WhatsApp number (phone OTP) or the email
// address (free email OTP). WhatsApp stays the contact channel in both cases; it is
// marked VERIFIED only when the phone itself was confirmed by Auth.
const confirmedAt=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+60000;
export function verifiedBuyerContact(input:Record<string,any>,user:{phone?:string;phone_confirmed_at?:string|null;email?:string|null;email_confirmed_at?:string|null}){
 const candidate=input.buyer||input.sourceContext?.buyer||{};
 const digits=(v:unknown)=>String(v||'').replace(/[\s()-]/g,'').replace(/^\+/,'');
 const name=String(candidate.name||'').trim(),company=String(candidate.company||'').trim(),email=String(candidate.email||'').trim().toLowerCase(),whatsapp=digits(candidate.whatsapp);
 const phone=digits(user.phone),authEmail=String(user.email||'').trim().toLowerCase();
 const phoneVerified=/^[1-9]\d{7,14}$/.test(phone)&&confirmedAt(user.phone_confirmed_at)&&whatsapp===phone;
 const emailVerified=!!authEmail&&confirmedAt(user.email_confirmed_at)&&email===authEmail;
 if(!phoneVerified&&!emailVerified)throw new Error('phone_verification_required');
 if(name.length<1||name.length>120||company.length<1||company.length>200||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||!/^[1-9]\d{7,14}$/.test(whatsapp))throw new Error('invalid_buyer_contact');
 return{name,company,email:email||null,whatsapp:'+'+whatsapp,whatsappStatus:phoneVerified?'VERIFIED':'UNCONFIRMED',verifiedAt:phoneVerified?user.phone_confirmed_at:user.email_confirmed_at,verifiedBy:phoneVerified?'PHONE':'EMAIL'};
}
