'use client';

import { useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { NETWORK_LABEL, SIGNING_ENABLED, missingWritePrerequisites } from '../lib/genlayer';
import { acceptanceCallPreview } from '../lib/job-workflow.mjs';
import {
  buildPolicy,
  validateCriteria,
  type Criterion,
} from '../lib/policy';
import { CriteriaBuilder } from './CriteriaBuilder';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function NewJobPanel({
  account,
  criteria,
  onCriteriaChange,
}: {
  account: string | null;
  criteria: Criterion[];
  onCriteriaChange: (next: Criterion[]) => void;
}) {
  const [seller, setSeller] = useState('');

  const builderProblems = useMemo(() => validateCriteria(criteria), [criteria]);
  const policy = useMemo(() => {
    if (builderProblems.length > 0) return null;
    try {
      return JSON.stringify(buildPolicy(criteria));
    } catch {
      return null;
    }
  }, [criteria, builderProblems]);

  const sellerValid =
    isAddress(seller) &&
    (!account || seller.toLowerCase() !== account.toLowerCase());

  const totalWeight = criteria.reduce((n, c) => n + (c.weight || 0), 0);
  const missing = missingWritePrerequisites();

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Create an acceptance job
      </h1>
      <p className="mt-1 text-[15px] text-[#5B6068]">
        Define what successful work means before the seller begins.
      </p>

      <div className="mt-6">
        <label htmlFor="authorized-seller" className="mb-1.5 block text-sm font-medium">
          Authorized seller <span className="text-[#DC2626]">(required)</span>
        </label>
        <Input
          id="authorized-seller"
          className="mono"
          inputMode="text"
          autoComplete="off"
          placeholder="0x…"
          value={seller}
          onChange={(event) => setSeller(event.target.value.trim())}
          aria-invalid={seller.length > 0 && !sellerValid}
          required
        />
        {seller.length > 0 && !sellerValid ? (
          <p className="mt-1 text-xs text-[#DC2626]">
            Enter a valid address distinct from the connected buyer.
          </p>
        ) : null}
      </div>

      <div className="mt-5">
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
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium">Acceptance call preview · create_job(policy_json: str, seller: Address)</summary>
          {policy && sellerValid && account
            ? <pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify({ ...acceptanceCallPreview('create_job', [policy, seller]), sender: account }, null, 2)}</pre>
            : <p className="mt-2 text-xs text-[#5B6068]">Enter valid criteria, connect the buyer wallet, and provide a seller address to preview the typed arguments.</p>}
        </details>
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
            <dd className="mono">unavailable</dd>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <dt className="text-[#5B6068]">Deposit</dt>
            <dd className="text-[#5B6068]">unavailable</dd>
          </div>
        </dl>
        <details className="mt-2">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-[#1E40AF] hover:underline [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-h-[44px] items-center">
              Advanced transaction details
            </span>
          </summary>
          <p className="text-[13px] leading-relaxed text-[#5B6068]">
            This build has no complete, verified fee quote for the target network.
            Creation remains disabled until deployment identities and the fee path are verified.
          </p>
        </details>
      </div>

      <div className="mt-4">
        <p role="status" className="mb-3 rounded-[10px] border border-[#E8E6E1] bg-[#F4F3F0] px-4 py-3 text-sm text-[#5B6068]">
          {`Creation on ${NETWORK_LABEL} is disabled. Missing: ${missing.join(', ')}.`}
        </p>
        <Button
          type="button"
          disabled={!SIGNING_ENABLED || !account || !sellerValid || policy === null}
          title="Signing is disabled in this build while network, deployment identity, and complete fee quote checks remain outstanding."
        >
          Create job · signing disabled
        </Button>
      </div>
    </div>
  );
}
