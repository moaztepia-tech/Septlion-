import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json({status:'ok',service:'septlion',environment:process.env.SEPTLION_DEPLOYMENT||'production',configured:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)},{headers:{'Cache-Control':'no-store'}})}
