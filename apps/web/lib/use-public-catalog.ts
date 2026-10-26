'use client';
import {useEffect,useState} from 'react';
import {publicCatalog,CatalogProduct} from './catalog-data';
export type PresentedProduct=CatalogProduct&{en:string;pack:string;note:string;image:string};
export function usePublicCatalog(){
 const[products,setProducts]=useState<PresentedProduct[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;publicCatalog().then(items=>{if(active)setProducts(items.map(p=>({...p,en:'',pack:p.skus.map(s=>s.specifications?.packing||s.name).join(' · '),note:p.description||'تُراجع المواصفة والتوفر في العرض.',image:p.skus.flatMap(s=>s.media||[]).filter(m=>m.type==='IMAGE'&&/^https:\/\//.test(m.url)).sort((a,b)=>a.sortOrder-b.sortOrder)[0]?.url||''}))) }).catch(e=>{if(active)setError(e instanceof Error?e.message:'تعذر تحميل الكتالوج.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false};},[]);
 return{products,error,loading};
}
