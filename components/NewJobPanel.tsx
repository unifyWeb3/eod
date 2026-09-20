'use client';

import { useMemo, useState } from 'react';
import { createTransactionKit } from '@genlayer/transaction-kit';
import { GenLayerTransactionPanel } from '@genlayer/transaction-kit-react';
import '@genlayer/transaction-kit-react/styles.css';
import { ACCEPTANCE_CONTRACT, CHAIN, FEE_PROFILE } from '../lib/genlayer';
import {
  buildPolicy,
  validateCriteria,
  type Criterion,
} from '../lib/policy';
import { CriteriaBuilder } from './CriteriaBuilder';
import {
  PHASE_TIMEOUT_MAX,
  PHASE_TIMEOUT_MIN,
  validateFeeProfile,
} from '../lib/fees';

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function NewJobPanel({
  account,
  criteria,
  onCriteriaChange,
}: {
  account: string | null;
  criteria: Criterion[];
  onCriteriaChange: (next: Criterion[]) => void;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const builderProblems = useMemo(() => validateCriteria(criteria), [criteria]);
  const policy = useMemo(() => {
    if (builderProblems.length > 0) return null;
    try {
      return JSON.stringify(buildPolicy(criteria));
    } catch {
      return null;
    }
  }, [criteria, builderProblems]);

  // Fail closed: never build a signing kit from an out-of-bounds profile.
  const profileProblems = useMemo(() => validateFeeProfile(FEE_PROFILE), []);

  const methodProfile: any = (FEE_PROFILE as any)?.methods?.create_job ?? {};

  const kit = useMemo(() => {
    if (!account || typeof window === 'undefined' || !window.ethereum)
      return null;
    if (policy === null) {
      setError(
        'Fix the criteria above before signing: ' +
          builderProblems.join(' '),
      );
      return null;
    }
    if (profileProblems.length > 0) {
      setError(
        'Fee profile blocked: ' +
          profileProblems.join(' | ') +
          ' — fix fee-profile.json before signing.',
      );
      return null;
    }
    try {
      return createTransactionKit({
        chain: CHAIN,
        provider: window.ethereum,
        account: account as `0x${string}`,
        suggestions: FEE_PROFILE as any,
      });
    } catch (e: any) {
      setError(String(e?.message ?? e));
      return null;
    }
  }, [account, policy, builderProblems, profileProblems]);

  const totalWeight = criteria.reduce((n, c) => n + (c.weight || 0), 0);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Create an acceptance job
      </h1>
      <p className="mt-1 text-[15px] text-[#5B6068]">
        Define what successful work means before the seller begins.
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-[#DC2626]">
          {error}
        </p>
      ) : null}

      <div className="mt-6">
        <CriteriaBuilder criteria={criteria} onChange={onCriteriaChange} />
      </div>

      <details className="mt-4 rounded-[10px] border border-[#E8E6E1] bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span className="inline-flex min-h-[44px] items-center">
            Advanced → View generated policy JSON
          </span>
        </summary>
        <div className="border-t border-[#E8E6E1] px-4 py-3">
          <pre className="mono overflow-x-auto text-xs leading-relaxed">
            {policy ?? '(invalid criteria — nothing to sign)'}
          </pre>
        </div>
      </details>

      <div className="mt-6 rounded-[10px] border border-[#E8E6E1] bg-white px-4 py-4">
        <h3 className="text-sm font-semibold">Review transaction</h3>
        <dl className="tnum mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-[#5B6068]">Policy</dt>
            <dd>
              {criteria.length} criteria · weight {totalWeight}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-[#5B6068]">Consensus</dt>
            <dd>Standard</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-[#5B6068]">Phase timeout</dt>
            <dd className="mono">
              {String(methodProfile.leaderTimeunitsAllocation ?? '?')} /{' '}
              {String(methodProfile.validatorTimeunitsAllocation ?? '?')}
            </dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-[#5B6068]">Deposit</dt>
            <dd className="text-[#5B6068]">quoted at signing below</dd>
          </div>
        </dl>
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-[#1E40AF] hover:underline [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-h-[44px] items-center">
              Advanced transaction details
            </span>
          </summary>
          <p className="text-[13px] leading-relaxed text-[#5B6068]">
            Allowed phase-timeout bounds {PHASE_TIMEOUT_MIN}–
            {PHASE_TIMEOUT_MAX}. Live GEN prices are quoted at signing;
            allocations come from the measured fee-profile.json. Verification
            must read “verified” before you sign.
          </p>
        </details>
      </div>

      <div className="mt-4">
        {kit ? (
          <GenLayerTransactionPanel
            kit={kit}
            tx={{
              kind: 'write',
              address: ACCEPTANCE_CONTRACT,
              method: 'create_job',
              args: [policy ?? ''],
            }}
            trackUntil="finalized"
            onDone={(status: any) => {
              const txid =
                status?.genlayerTxId ?? status?.hash ?? JSON.stringify(status);
              setDone(String(txid));
              fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txid: String(txid), policy }),
              }).catch(() => {});
            }}
          />
        ) : (
          <p className="rounded-[10px] border border-dashed border-[#E8E6E1] px-4 py-4 text-sm text-[#5B6068]">
            {account
              ? 'Complete valid criteria above to prepare your quote.'
              : 'Connect your wallet above to prepare a quote and submit.'}
          </p>
        )}
        {done ? (
          <p className="mono mt-3 break-all text-[13px]">done: {done}</p>
        ) : null}
      </div>
    </div>
  );
}
