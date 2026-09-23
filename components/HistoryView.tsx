'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from 'genlayer-js';
import { isAddress } from 'viem';
import { ACCEPTANCE_CONTRACT, CHAIN, EXPECTED_CHAIN_ID, GL_EXPLORER, NETWORK_LABEL } from '../lib/genlayer';
import { loadLiveJobs, receiptLabel } from '../lib/live-jobs.mjs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { JobWorkflowPanel } from './JobWorkflowPanel';

type LiveJob = {
  id: string;
  buyer?: string;
  seller?: string;
  status?: string;
  verdict?: string;
  rationale?: string;
  receipt?: string;
  policy_commitment?: string;
  evidence_commitment?: string;
  evidence_manifest?: any;
  envelope?: any;
  escrow?: string;
  funded_amount?: string;
  policy?: { criteria?: Array<{ id?: string; text?: string; weight?: number }> };
};

type LoadedJob = { job: LiveJob; receipt: string };

function verdictTone(verdict?: string): 'accept' | 'reject' | 'undetermined' | 'neutral' {
  if (verdict === 'ACCEPT') return 'accept';
  if (verdict === 'REJECT') return 'reject';
  if (verdict === 'UNDETERMINED') return 'undetermined';
  return 'neutral';
}

export function HistoryView({ account }: { account: string | null }) {
  const [jobs, setJobs] = useState<LoadedJob[]>([]);
  const [count, setCount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setJobs([]);
    setCount(null);
    if (!ACCEPTANCE_CONTRACT || !isAddress(ACCEPTANCE_CONTRACT)) {
      setError('Unavailable: no verified acceptance deployment is configured.');
      setLoading(false);
      return;
    }
    try {
      const client = createClient({ chain: CHAIN });
      const result = await loadLiveJobs({ client, address: ACCEPTANCE_CONTRACT, expectedChainId: EXPECTED_CHAIN_ID });
      setJobs(result.jobs);
      setCount(result.count);
    } catch (cause: any) {
      setError(`Unavailable: ${String(cause?.shortMessage ?? cause?.message ?? cause)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = jobs.find(({ job }) => job.id === selectedJobId);

  return (
    <section aria-labelledby="live-jobs-title" aria-live="polite">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="live-jobs-title" className="text-xl font-semibold tracking-tight">
            Live jobs and receipts
          </h1>
          <p className="mt-1 text-[15px] text-[#5B6068]">
            Read from the finalized state of the configured acceptance contract.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="mt-4 rounded-[10px] border border-[#E8E6E1] bg-white px-4 py-3 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Target network</dt>
            <dd>{NETWORK_LABEL} · chain ID checked on refresh</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Acceptance contract</dt>
            <dd className="mono break-all">{ACCEPTANCE_CONTRACT || 'Not configured'}</dd>
          </div>
        </dl>
      </div>

      {error ? (
        <p role="status" className="mt-5 rounded-[10px] border border-[#E8E6E1] bg-[#F4F3F0] px-4 py-4 text-sm text-[#5B6068]">
          {error}
        </p>
      ) : null}
      {!error && selected ? (
        <div className="mt-5"><JobWorkflowPanel job={selected.job as any} receipt={selected.receipt} account={account} onBack={() => setSelectedJobId(null)} /></div>
      ) : null}
      {loading && !error ? <p role="status" className="mt-5 text-sm text-[#5B6068]">Reading finalized jobs…</p> : null}
      {!selectedJobId && !loading && !error && jobs.length === 0 ? (
        <p className="mt-5 rounded-[10px] border border-[#E8E6E1] bg-white px-4 py-4 text-sm text-[#5B6068]">
          The configured contract has no jobs yet.
        </p>
      ) : null}
      {!selectedJobId && !loading && !error && jobs.length > 0 ? (
        <>
          <p className="mt-5 text-[13px] text-[#5B6068]">
            Showing {jobs.length} of {count} jobs · finalized reads only.
          </p>
          <div className="mt-3 space-y-3">
            {jobs.map(({ job, receipt }) => (
              <article key={job.id} className="rounded-[10px] border border-[#E8E6E1] bg-white px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mono text-sm font-semibold">{job.id}</h2>
                  <Badge tone={verdictTone(job.verdict)}>{job.verdict || job.status || '—'}</Badge>
                  <span className="ms-auto text-xs text-[#5B6068]">{job.status || '—'}</span>
                </div>
                <Button className="mt-3" variant="secondary" onClick={() => setSelectedJobId(job.id)}>Open job workflow</Button>
                <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Buyer</dt>
                    <dd className="mono break-all">{job.buyer || '—'}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Authorized seller</dt>
                    <dd className="mono break-all">{job.seller || '—'}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Finalized receipt</dt>
                    <dd className="mono mt-1 break-all">
                      {receipt ? receipt : <span className="font-sans text-[#5B6068]">{receiptLabel(receipt)}</span>}
                    </dd>
                  </div>
                  {job.rationale ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Rationale</dt>
                      <dd className="mt-1">{job.rationale}</dd>
                    </div>
                  ) : null}
                </dl>
                {job.policy?.criteria?.length ? (
                  <details className="mt-4 border-t border-[#E8E6E1] pt-3">
                    <summary className="cursor-pointer text-sm font-medium">Policy criteria</summary>
                    <ol className="mt-2 list-decimal space-y-1 ps-5 text-sm text-[#5B6068]">
                      {job.policy.criteria.map((criterion, index) => (
                        <li key={criterion.id || index}>
                          {criterion.text || '—'}{typeof criterion.weight === 'number' ? ` (weight ${criterion.weight})` : ''}
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                {receipt ? (
                  <a className="mt-3 inline-block text-xs text-[#1E40AF] hover:underline" href={`${GL_EXPLORER}/address/${ACCEPTANCE_CONTRACT}`} target="_blank" rel="noreferrer">
                    View contract on GenLayer explorer
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
