export type SeptlionScale='Micro'|'Nano'|'Zepto'|'Yocto'|'Ronto'|'Quecto'|'Septlion';
export const SCALE_RANGES=[
 {name:'Micro' as const,min:1,max:7,label:'1–7'},
 {name:'Nano' as const,min:8,max:19,label:'8–19'},
 {name:'Zepto' as const,min:20,max:49,label:'20–49'},
 {name:'Yocto' as const,min:50,max:99,label:'50–99'},
 {name:'Ronto' as const,min:100,max:299,label:'100–299'},
 {name:'Quecto' as const,min:300,max:999,label:'300–999'},
 {name:'Septlion' as const,min:1000,max:Number.POSITIVE_INFINITY,label:'1000+'},
];
export function getSeptlionScale(count:number):SeptlionScale{
 const safe=Math.max(1,Math.floor(Number.isFinite(count)?count:1));
 return SCALE_RANGES.find(x=>safe>=x.min&&safe<=x.max)?.name??'Septlion';
}
export function scaleProgress(count:number){
 const safe=Math.max(1,Math.floor(count));
 if(safe>=1000)return 100;
 const stops=[1,8,20,50,100,300,1000];
 let i=stops.findIndex((s,idx)=>idx<stops.length-1&&safe>=s&&safe<stops[idx+1]);
 if(i<0)i=stops.length-2;
 const local=(safe-stops[i])/(stops[i+1]-stops[i]);
 return Math.min(99,((i+local)/(stops.length-1))*100);
}