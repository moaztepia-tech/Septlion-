import {cookies} from 'next/headers';
import {COMMAND_COOKIE, commandIdentity} from '../../lib/command-auth';
import CommandAccess from './access';
import CommandCenter from './command-center';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function CommandPage(){
 const identity=await commandIdentity((await cookies()).get(COMMAND_COOKIE)?.value||'');
 if(!identity)return <CommandAccess/>;
 return <CommandCenter role={identity.role}/>;
}
