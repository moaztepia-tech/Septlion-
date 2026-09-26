import { RFQStatus } from '@prisma/client';
const t: Record<RFQStatus, RFQStatus[]> = { DRAFT:['OPEN','CANCELLED'], OPEN:['QUOTED','CANCELLED','EXPIRED'], QUOTED:['NEGOTIATING','ACCEPTED','REJECTED','EXPIRED'], NEGOTIATING:['QUOTED','ACCEPTED','REJECTED'], ACCEPTED:[], REJECTED:[], CANCELLED:[], EXPIRED:[] };
export function assertRfqTransition(from: RFQStatus,to: RFQStatus){ if(!t[from].includes(to)) throw new Error(`Invalid RFQ transition ${from} -> ${to}`); }
