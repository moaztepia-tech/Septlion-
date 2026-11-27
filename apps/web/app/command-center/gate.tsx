'use client';
import {useCallback, useEffect, useState} from 'react';
import {edge, hasSession} from '../../lib/api';
import CommandAccess from './access';
import CommandCenter from './command-center';

type Role='ADMIN'|'SALES';
type State={status:'checking'}|{status:'denied';error?:string}|{status:'allowed';role:Role};
type Me={isOperator?:unknown;operatorRole?:unknown};

export async function operatorRole():Promise<Role|null>{
 const me=await edge<Me>('me');
 return me?.isOperator===true&&(me.operatorRole==='ADMIN'||me.operatorRole==='SALES')?me.operatorRole:null;
}

export default function CommandGate(){
 const [state,setState]=useState<State>({status:'checking'});
 const check=useCallback(async(explicit:boolean)=>{
  if(!hasSession()){setState({status:'denied',...(explicit?{error:'سجّل الدخول بحساب تشغيلي أولًا.'}:{})});return;}
  setState({status:'checking'});
  try{const role=await operatorRole();setState(role?{status:'allowed',role}:{status:'denied',error:'هذا الحساب ليس من فريق سبتليون. سجّل الدخول بحساب الفريق.'});}
  catch(e){setState({status:'denied',...(explicit?{error:e instanceof Error?e.message:'تعذر التحقق من الدخول'}:{})});}
 },[]);
 useEffect(()=>{void check(false);},[check]);
 if(state.status==='allowed')return <CommandCenter role={state.role}/>;
 return <CommandAccess busy={state.status==='checking'} error={state.status==='denied'?state.error:undefined} onEnter={()=>void check(true)}/>;
}
