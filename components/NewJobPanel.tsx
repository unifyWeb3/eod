'use client';

import { useMemo, useState } from 'react';
import { createTransactionKit } from '@genlayer/transaction-kit';
import { GenLayerTransactionPanel } from '@genlayer/transaction-kit-react';
import '@genlayer/transaction-kit-react/styles.css';
import {
  ACCEPTANCE_CONTRACT,
  CHAIN,
  DEMO_POLICY,
  FEE_PROFILE,
} from '../lib/genlayer';
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

export default function NewJobPanel() {
  const [account, setAccount] = useState<string | null>(null);
  const [policy, setPolicy] = useState(DEMO_POLICY);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fail closed: never build a signing kit from an out-of-bounds profile.
  const profileProblems = useMemo(
    () => validateFeeProfile(FEE_PROFILE),
    [],
  );

  const methodProfile: any = (FEE_PROFILE as any)?.methods?.create_job ?? {};

  const kit = useMemo(() => {
    if (!account || typeof window === 'undefined' || !window.ethereum)
      return null;
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
  }, [account, profileProblems]);

  async function connect() {
    setError(null);
    if (!window.ethereum) {
      setError('No injected wallet found.');
      return;
    }
    const accounts: string[] = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });
    setAccount(accounts[0] ?? null);
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 12 }}>
      {!account ? (
        <button onClick={connect}>Connect wallet</button>
      ) : (
        <p>connected {account.slice(0, 10)}…</p>
      )}
      {error ? <p style={{ color: 'red' }}>{error}</p> : null}
      <p>
        Signing timeouts for <code>create_job</code> (allowed{' '}
        {PHASE_TIMEOUT_MIN}–{PHASE_TIMEOUT_MAX}): leader{' '}
        {String(methodProfile.leaderTimeunitsAllocation ?? '?')}, validator{' '}
        {String(methodProfile.validatorTimeunitsAllocation ?? '?')}. Live GEN
        prices are quoted at signing; these allocations come from
        fee-profile.json.
      </p>
      <label>
        Policy JSON (2–4 criteria)
        <br />
        <textarea
          rows={8}
          cols={70}
          value={policy}
          onChange={(e) => setPolicy(e.target.value)}
        />
      </label>
      {kit ? (
        <GenLayerTransactionPanel
          kit={kit}
          tx={{
            kind: 'write',
            address: ACCEPTANCE_CONTRACT,
            method: 'create_job',
            args: [policy],
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
        <p>Connect a wallet to quote from fee-profile.json and submit.</p>
      )}
      {done ? <p>done: {done}</p> : null}
    </div>
  );
}
