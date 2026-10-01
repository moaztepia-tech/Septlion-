export function GET(){
 return new Response(`# Septlion Supply

Septlion Supply is the demand-led product development and managed supply arm of Septlion LLC.

## Demand Intelligence
- Septlion uses public tenders, RFQs and B2B buy requests as demand signals.
- Demand signals are clustered by product and market.
- Matching demand clusters become public market-specific supply routes at https://septlion.com/demand/
- Buyer identities and private execution data are not exposed in public demand pages.
- Buyers can submit a live RFQ from the matching demand route.

## What we do
- Translate buyer requirements into production-ready specifications.
- Qualify suppliers and coordinate samples, costing, compliance, production, and delivery.
- Serve buyers and supply partners across MENA and Africa.

## Operating path
Public demand signal -> Demand cluster -> Market-specific demand page -> Buyer RFQ -> Supply qualification -> Commercial offer -> Trade execution -> Repeat and scale.
`,{headers:{'content-type':'text/plain; charset=utf-8'}})
}
