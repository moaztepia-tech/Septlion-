import {demandSignals} from '../../signals';
import Redirect from './redirect';

// Old public opportunity briefs: the radar is team-only now, so each address sends to the team radar.
export function generateStaticParams(){return demandSignals.map(s=>({id:s.id}))}
export const metadata={robots:{index:false,follow:false}};
export default function OpportunityPage(){return <Redirect/>}
