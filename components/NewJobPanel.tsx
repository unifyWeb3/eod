'use client';

import { useMemo, useState } from 'react';
import { isAddress } from 'viem';
import { ACCEPTANCE_CONTRACT, NETWORK_LABEL, SIGNING_ENABLED } from '../lib/genlayer';
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
            The Bradbury fee manager currently reverts on fee quote methods.
            Creation remains disabled until the fee path is verified.
          </p>
        </details>
      </div>

      <div className="mt-4">
        <p role="status" className="mb-3 rounded-[10px] border border-[#E8E6E1] bg-[#F4F3F0] px-4 py-3 text-sm text-[#5B6068]">
          {ACCEPTANCE_CONTRACT
            ? `Creation on ${NETWORK_LABEL} is disabled until the deployment and fee path are verified.`
            : 'Creation is disabled: no verified acceptance deployment is configured.'}
        </p>
        <Button
          type="button"
          disabled={!SIGNING_ENABLED || !account || !sellerValid || policy === null}
          title="Transaction signing is disabled until the network fee path is verified."
        >
          Create job · signing disabled
        </Button>
      </div>
    </div>
  );
}
