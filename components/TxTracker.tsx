'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient, isSuccessful } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';

const PHASES = ['Submitted', 'Decided', 'Finalized'] as const;

function phaseIndex(state?: string): number {
  if (state === 'finalized') return 2;
  if (state === 'decided') return 1;
  return 0;
}

function phaseCopy(state?: string, statusName?: string): string {
  if (state === 'finalized')
    return 'Finalized. Fee accounting and refunds are settled; the result is durable.';
  if (state === 'decided')
    return 'Decided. Validators have agreed; waiting out the appeal window before finalization.';
  return `Submitted${statusName ? ` (${statusName})` : ''}. The transaction is queued or under consensus — validators independently re-judge the evidence. Typical waits run 35–260s; this is normal, not a stall.`;
}

function fmtGenwei(v: unknown): string | null {
  try {
    if (v === null || v === undefined) return null;
    const n = BigInt(v as string);
    const whole = n / 10n ** 18n;
    const frac = ((n % 10n ** 18n) / 10n ** 12n).toString().padStart(6, '0');
    return `${whole}.${frac}`;
  } catch {
    return null;
  }
}

export function TxTracker({ defaultHash = '' }: { defaultHash?: string }) {
  const [hash, setHash] = useState(defaultHash);
  const [query, setQuery] = useState(defaultHash);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!query) {
      setData(null);
      return;
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(query)) {
      setData(null);
      setError('Enter a full 0x transaction hash (66 characters).');
      return;
    }
    let stop = false;
    const client = createClient({ chain: studioDevnet });
    async function poll() {
      try {
        // Regex above guarantees 0x + 64 hex; the client types the
        // hash narrowly, so pass through after validation.
        const tx: any = await client.getTransaction({
          hash: query as any,
        });
        if (!stop) {
          setData(tx);
          setError(null);
        }
      } catch (e: any) {
        if (!stop) setError(String(e?.shortMessage ?? e?.message ?? e));
      }
    }
    poll();
    timer.current = setInterval(poll, 15000);
    return () => {
      stop = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [query]);

  const state: string | undefined =
    data?.lifecycle?.state ?? data?.lifecycle ?? undefined;
  const idx = phaseIndex(state);
  const ok = data ? isSuccessful(data) : null;
  const fees = data?.fees ?? {};
  const consumed = fees?.consumed ?? {};
  const deposit = fmtGenwei(fees?.deposit);
  const execUsed = fmtGenwei(consumed?.executionConsumed);

  return (
    <Card>
      <h3 className="text-[15px] font-semibold">Track a transaction</h3>
      <p className="mt-1 text-[13px] text-[#5B6068]">
        Read-only. Paste any studio-dev transaction hash — no wallet needed.
      </p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(hash.trim());
        }}
      >
        <label htmlFor="tx-hash" className="sr-only">
          Transaction hash
        </label>
        <Input
          id="tx-hash"
          className="mono"
          placeholder="0x…"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
        />
        <Button variant="secondary" type="submit">
          Track
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-[#DC2626]">
          {error}
        </p>
      ) : null}
      {data ? (
        <div className="mt-4">
          <ol
            className="relative flex items-center gap-1 sm:gap-2"
            aria-label="Transaction lifecycle"
          >
            <span
              aria-hidden="true"
              className="absolute right-4 left-4 hidden h-px bg-[#E8E6E1] min-[420px]:block"
            />
            {PHASES.map((p, i) => (
              <li key={p} className="relative flex flex-1 items-center">
                <span
                  aria-current={i === idx ? 'step' : undefined}
                  className={
                    'inline-flex min-h-[32px] flex-1 items-center justify-center rounded-full border px-2 text-xs font-semibold ' +
                    (i < idx
                      ? 'border-[#15803D]/30 bg-[#F0FDF4] text-[#15803D]'
                      : i === idx
                        ? 'border-[#3B5BFD]/40 bg-[#3B5BFD]/5 text-[#1E40AF]'
                        : 'border-[#E8E6E1] bg-white text-[#5B6068]')
                  }
                >
                  {p}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] leading-relaxed text-[#5B6068]">
            {phaseCopy(state, data?.statusName)}
          </p>
          <dl className="tnum mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-[#5B6068]">Status</dt>
              <dd className="mono">{String(data?.statusName ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#5B6068]">Execution</dt>
              <dd>
                <Badge
                  tone={
                    ok ? 'accept' : ok === false ? 'reject' : 'neutral'
                  }
                >
                  {String(data?.txExecutionResultName ?? 'pending')}
                </Badge>
              </dd>
            </div>
            {deposit !== null ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[#5B6068]">Fee deposit</dt>
                <dd className="mono">{deposit} GEN</dd>
              </div>
            ) : null}
            {execUsed !== null ? (
              <div className="flex justify-between gap-3">
                <dt className="text-[#5B6068]">Execution consumed</dt>
                <dd className="mono">{execUsed} GEN</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </Card>
  );
}
