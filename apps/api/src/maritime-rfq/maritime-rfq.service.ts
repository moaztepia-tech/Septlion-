import {BadRequestException,Injectable,NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {ClassifyMaritimeRfqDto,EstimateMaritimeRfqDto,SubmitMaritimeRfqDto} from './maritime-rfq.dto';

const LEVELS=[
 {code:'S-1',exclusiveName:'Micro',maritimeTerm:'Spot FCL',description:'حجز فوري للشحنات المحدودة',minContainers:1,maxContainers:7},
 {code:'S-2',exclusiveName:'Nano',maritimeTerm:'Scheduled FCL',description:'عقود توريد مجدولة لتجار الجملة',minContainers:8,maxContainers:19},
 {code:'S-3',exclusiveName:'Zepto',maritimeTerm:'Space Allocation',description:'تخصيص منتظم للمساحة',minContainers:20,maxContainers:49},
 {code:'S-4',exclusiveName:'Yocto',maritimeTerm:'Block Space',description:'حجز كتلة مساحية',minContainers:50,maxContainers:99},
 {code:'S-5',exclusiveName:'Ronto',maritimeTerm:'Coastal Charter',description:'تأجير ساحلي مخصص',minContainers:100,maxContainers:299},
 {code:'S-6',exclusiveName:'Quecto',maritimeTerm:'Feeder Charter',description:'تأجير سفينة تغذية',minContainers:300,maxContainers:999},
 {code:'S-7',exclusiveName:'Septlion',maritimeTerm:'Full Charter & Bulk',description:'تأجير كامل أو شحن سائب',minContainers:1000,maxContainers:null}
];
const BASE:Record<string,number>={"20FT":1650,"40FT":2600,REEFER:4300,OPEN_TOP:3350,FLAT_RACK:3900,BULK:5200};

@Injectable()
export class MaritimeRfqService{
 constructor(private prisma:PrismaService){}
 classify(dto:ClassifyMaritimeRfqDto){
  if(!Number.isInteger(dto.containerCount))throw new BadRequestException('عدد الحاويات يجب أن يكون رقمًا صحيحًا');
  const level=dto.containerType==='BULK'?LEVELS[6]:LEVELS.find(x=>dto.containerCount>=x.minContainers&&(x.maxContainers===null||dto.containerCount<=x.maxContainers))!;
  return {...level,teu:dto.containerType==='40FT'?dto.containerCount*2:dto.containerCount};
 }
 estimate(dto:EstimateMaritimeRfqDto){
  const classification=this.classify(dto);const base=BASE[dto.containerType]||2200;
  const longHaul=/China|Shanghai|Ningbo|Shenzhen|Rotterdam|Türkiye|Mersin/i.test(`${dto.pol}${dto.pod}`)?1.42:1;
  const month=dto.shipDate?new Date(dto.shipDate).getUTCMonth()+1:new Date().getUTCMonth()+1;
  const season=[8,9,10,11].includes(month)?1.12:1;
  const volume=Math.max(.78,1-Math.min(dto.containerCount,300)*.0007);
  const surcharges=[{code:'BAF',percentage:8},{code:'CAF',percentage:3},{code:'PSS',percentage:5}];
  const factor=1+surcharges.reduce((s,x)=>s+x.percentage,0)/100;const freight=base*longHaul*season*volume;
  const valid=new Date();valid.setUTCDate(valid.getUTCDate()+7);
  return {classification,pricing:{currency:'USD',min:Math.round(freight*.9*factor/50)*50,max:Math.round(freight*1.18*factor/50)*50,validUntil:valid.toISOString(),surcharges,disclaimer:'Indicative and non-binding. Subject to carrier, routing, space and sailing confirmation.'}};
 }
 async submit(dto:SubmitMaritimeRfqDto){
  const found=await this.prisma.maritimeRFQ.findUnique({where:{idempotencyKey:dto.idempotencyKey}});if(found)return found;
  const result=this.estimate(dto);const c=result.classification,p=result.pricing;
  const reference=`RFQ-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  return this.prisma.maritimeRFQ.create({data:{reference,idempotencyKey:dto.idempotencyKey,customerName:dto.customerName,company:dto.company,email:dto.email.toLowerCase(),phone:dto.phone,containerCount:dto.containerCount,containerType:dto.containerType,teu:c.teu,pol:dto.pol,pod:dto.pod,incoterm:dto.incoterm,cargoType:dto.cargoType,shipDate:new Date(dto.shipDate),grossWeight:dto.grossWeight,cbm:dto.cbm,finalDestinations:dto.finalDestinations||1,paymentTerm:dto.paymentTerm,notes:dto.notes,sCode:c.code,exclusiveName:c.exclusiveName,maritimeTerm:c.maritimeTerm,priceMin:p.min,priceMax:p.max,currency:p.currency,surcharges:p.surcharges,validUntil:new Date(p.validUntil),audits:{create:{action:'RFQ_SUBMITTED',metadata:{source:'web'}}}}});
 }
 async get(id:string){const item=await this.prisma.maritimeRFQ.findUnique({where:{id}});if(!item)throw new NotFoundException('RFQ غير موجود');return item;}
 async pdf(id:string){const r=await this.get(id);const text=[`SEPTLION MARITIME RFQ`,`Reference: ${r.reference}`,`Customer: ${r.customerName} / ${r.company}`,`Route: ${r.pol} -> ${r.pod}`,`Shipment: ${r.containerCount} x ${r.containerType} (${r.teu} TEU)`,`Cargo: ${r.cargoType} | Incoterm: ${r.incoterm}`,`Maritime term: ${r.maritimeTerm}`,`Indicative range: ${r.currency} ${r.priceMin} - ${r.priceMax} per unit`,`Valid until: ${r.validUntil.toISOString().slice(0,10)}`,`Non-binding indication subject to carrier, routing, space and sailing confirmation.`];return makePdf(text);}
}
function makePdf(lines:string[]){const esc=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');const body=lines.map((x,i)=>`BT /F1 ${i===0?18:11} Tf 55 ${790-i*42} Td (${esc(x)}) Tj ET`).join('\n');const objects=[`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`,`2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`,`3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj`,`4 0 obj << /Length ${Buffer.byteLength(body)} >> stream\n${body}\nendstream endobj`,`5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`];let pdf='%PDF-1.4\n',offsets=[0];for(const o of objects){offsets.push(Buffer.byteLength(pdf));pdf+=o+'\n'}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')+`\ntrailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);}
