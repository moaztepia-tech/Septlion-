// Only the Auth server's verified user is evidence; never user_metadata or a UI flag.
export function verifiedBuyerContact(input:Record<string,any>,user:{phone?:string;phone_confirmed_at?:string|null}){
 const candidate=input.buyer||input.sourceContext?.buyer||{};
 const digits=(v:unknown)=>String(v||'').replace(/^\+/,'');
 const phone=digits(user.phone);
 if(!/^[1-9]\d{7,14}$/.test(phone)||!user.phone_confirmed_at||!Number.isFinite(Date.parse(user.phone_confirmed_at))||Date.parse(user.phone_confirmed_at)>Date.now()+60000)throw new Error('phone_verification_required');
 if(digits(candidate.whatsapp)!==phone)throw new Error('phone_verification_required');
 const name=String(candidate.name||'').trim(),company=String(candidate.company||'').trim(),email=String(candidate.email||'').trim();
 if(name.length<1||name.length>120||company.length<1||company.length>200||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('invalid_buyer_contact');
 return{name,company,email:email||null,whatsapp:'+'+phone,whatsappStatus:'VERIFIED',verifiedAt:user.phone_confirmed_at};
}
