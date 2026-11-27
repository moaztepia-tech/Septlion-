export const SEARCH_TERMS = ['flour','pasta','sesame','sunflower oil','tomato paste','biscuits','hibiscus','halva'];
export function noticeDate(input: unknown): string | null {
 const value=String(input??'').trim();
 if(!value)return null;
 const day=value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
 const month=day?['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(day[2].toLowerCase()):-1;
 const parsed=day?(month<0?NaN:Date.UTC(Number(day[3]),month,Number(day[1])))
  :Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00Z':value);
 return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}
export function normalizeNotice(r:Record<string,unknown>,now=Date.now()) {
 const title=String(r.bid_description??'').replace(/<[^>]*>/g,' ').trim();
 const publishedAt=noticeDate(r.publication_date??r.noticedate);
 const deadlineAt=noticeDate(r.submission_deadline_date??r.deadline_date);
 if(!publishedAt||Date.parse(publishedAt)>now||Date.parse(publishedAt)<now-7*86400000)return null;
 if(deadlineAt&&Date.parse(deadlineAt)<=now)return null;
 // Contract awards and machinery are not current commodity purchase requests.
 if(!/invitation for bids|request for quotation|specific procurement notice/i.test(String(r.notice_type??'')))return null;
 if(/\b(machinery|equipment|software|construction|consultancy|premix|fortification equipment)\b/i.test(title))return null;
 const productKey= /\b(wheat flour|fortified flour)\b/i.test(title)?'wheat_flour'
  : /\b(pasta|spaghetti|macaroni)\b/i.test(title)?'pasta'
  : /\bsesame\b/i.test(title)?'sesame'
  : /sunflower oil/i.test(title)?'sunflower_oil'
  : /tomato paste/i.test(title)?'tomato_paste'
  : /\bbiscuits?\b/i.test(title)?'tea_biscuit'
  : /\bhibiscus\b/i.test(title)?'hibiscus'
  : /\b(halva|halawa)\b/i.test(title)?'halva':null;
 const id=String(r.id??'');
 if(!productKey||!/^OP[0-9]+$/.test(id))return null;
 return {
  source:'World Bank Procurement Notices',sourceRecordId:id,
  sourceUrl:`https://projects.worldbank.org/en/projects-operations/procurement-detail/${id}`,
  type:'TENDER',market:String(r.country_name??r.project_ctry_name??'Unresolved market'),
  product:title,productKey,quantity:null,buyerName:null,publishedAt,deadlineAt,
  incoterm:null,packing:null,verification:'SOURCE_SIGNAL',score:65,
  intentPageCandidate:false,
  evidence:{sourceIndex:true,collector:'world-bank-procurement',noticeType:r.notice_type,normalizedAt:new Date(now).toISOString()},
  raw:r,lastSeenAt:new Date(now).toISOString(),
 };
}
