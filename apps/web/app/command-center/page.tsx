import CommandGate from './gate';
export const metadata={robots:{index:false,follow:false}};
// Static page: Hostinger serves it as plain HTML. The browser asks trade-api who the
// signed-in user is; every catalog and request action is authorized again by trade-api.
export default function CommandPage(){return <CommandGate/>;}
