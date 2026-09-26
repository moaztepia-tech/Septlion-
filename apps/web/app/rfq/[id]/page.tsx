'use client';
import { useEffect, useState } from 'react';
import { api, accessToken } from '../../../lib/api';
import { TransactionWorkspace } from '../../../components/workspace/TransactionWorkspace';

export default function RfqDetailPage({ params }: { params: { id: string } }) {
  const [rfq, setRfq] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const token = accessToken();
    if (!token) { window.location.href = '/'; return; }
    Promise.all([api<any>(`/rfq/${params.id}`, {}, token), api<any[]>(`/supplier-matching/rfq/${params.id}`, {}, token)])
      .then(([r, m]) => { setRfq(r); setMatches(m); })
      .catch(e => setError(e.message));
  }, [params.id]);
  if (!rfq) return <main className="min-h-screen bg-black p-6 text-white">Loading…</main>;
  return <main className="min-h-screen bg-black p-5 text-white"><div className="mx-auto max-w-5xl"><div className="text-xs tracking-[.3em] text-white/40">SEPTLION / RFQ</div><div className="mt-3 flex items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{rfq.reference}</h1><span className="rounded-full bg-white/10 px-3 py-1 text-xs">{rfq.status}</span></div><div className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-white/10 p-5"><div className="text-xs text-white/40">Destination</div><div className="mt-2">{rfq.deliveryCountry || '—'} / {rfq.deliveryPort || '—'}</div></div><div className="rounded-2xl border border-white/10 p-5"><div className="text-xs text-white/40">Items</div><div className="mt-2">{rfq.items.length}</div></div><div className="rounded-2xl border border-white/10 p-5"><div className="text-xs text-white/40">Quotes</div><div className="mt-2">{rfq.quotes.length}</div></div></div><section className="mt-10"><h2 className="text-xl font-semibold">Supplier Matching</h2><div className="mt-4 space-y-3">{matches.map(m => <div key={m.supplierOrgId} className="rounded-2xl border border-white/10 p-5"><div className="flex justify-between"><span className="font-medium">{m.supplierName}</span><span className="text-sm text-white/50">Score {m.score}</span></div><div className="mt-3 text-sm text-white/50">{m.matchedItems.length} of {rfq.items.length} requested SKU(s) matched</div></div>)}{!matches.length && <div className="rounded-2xl border border-white/10 p-5 text-white/50">No public supplier matches found.</div>}</div></section><section className="mt-10"><h2 className="text-xl font-semibold">Quotes</h2><div className="mt-4 space-y-3">{rfq.quotes.map((q:any)=><a href={`/quotes/${q.id}`} key={q.id} className="block rounded-2xl border border-white/10 p-5 hover:bg-white/[.04]"><div className="flex justify-between"><span>{q.id.slice(0, 8)}…</span><span className="text-xs text-white/50">{q.status}</span></div></a>)}</div></section><TransactionWorkspace entityType="RFQ" entityId={params.id}/>{error && <p className="mt-6 text-red-400">{error}</p>}</div></main>;
}
