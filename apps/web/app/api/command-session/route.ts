import {NextRequest, NextResponse} from 'next/server';
import {COMMAND_COOKIE, commandIdentity} from '../../../lib/command-auth';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({error:'Forbidden origin'}, {status:403});
  if (Number(request.headers.get('content-length')) > 16000) return NextResponse.json({error:'Request too large'}, {status:413});
  const raw = await request.text();
  if (raw.length > 16000) return NextResponse.json({error:'Request too large'}, {status:413});
  let token: unknown;
  try {token = JSON.parse(raw).token;} catch {return NextResponse.json({error:'Invalid input'}, {status:400});}
  if (typeof token !== 'string' || !token || token.length > 12000) return NextResponse.json({error:'Invalid token'}, {status:400});
  if (!await commandIdentity(token)) return NextResponse.json({error:'Operator access required'}, {status:403});
  const response = NextResponse.json({ok:true}, {headers:{'Cache-Control':'no-store'}});
  response.cookies.set(COMMAND_COOKIE, token, {httpOnly:true, secure:request.nextUrl.protocol==='https:', sameSite:'strict', path:'/command-center', maxAge:900});
  return response;
}

export async function DELETE(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Forbidden origin'},{status:403});
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set(COMMAND_COOKIE,'',{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'strict',path:'/command-center',maxAge:0});return response;
}
