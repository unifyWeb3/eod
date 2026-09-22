'use client';

import { useState } from 'react';
import { AppShell, type AppView } from '../../components/app-shell';
import NewJobPanel from '../../components/NewJobPanel';
import { HistoryView } from '../../components/HistoryView';
import { TxTracker } from '../../components/TxTracker';
import { DEFAULT_CRITERIA, type Criterion } from '../../lib/policy';
import { ACCEPTANCE_CONTRACT, NETWORK_LABEL } from '../../lib/genlayer';
import { connectWallet, shortAddress } from '../../lib/wallet';

export default function AppClient() {
  const [view, setView] = useState<AppView>('history');
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [criteria, setCriteria] =
    useState<Criterion[]>(DEFAULT_CRITERIA);

  async function handleConnect() {
    setConnecting(true);
    try {
      const { account: a } = await connectWallet();
      if (a) setAccount(a);
    } finally {
      setConnecting(false);
    }
  }

  const totalWeight = criteria.reduce((n, c) => n + (c.weight || 0), 0);

  return (
    <>
      <AppShell
        view={view}
        onView={setView}
        account={account}
        onConnect={handleConnect}
        connecting={connecting}
      />
      <main id="main" className="mx-auto max-w-[1120px] px-4 py-8 sm:px-6 md:py-10">
        {view === 'create' ? (
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              <NewJobPanel
                account={account}
                criteria={criteria}
                onCriteriaChange={setCriteria}
              />
            </div>
            <aside
              aria-label="Job summary"
              className="lg:sticky lg:top-6 lg:self-start"
            >
              <div className="rounded-[10px] border border-[#E8E6E1] bg-[#F4F3F0] px-4 py-4 text-sm">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[#5B6068]">
                  Summary
                </h2>
                <dl className="tnum mt-2 space-y-1.5">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Criteria</dt>
                    <dd>{criteria.length}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Total weight</dt>
                    <dd>{totalWeight}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Network</dt>
                    <dd>{NETWORK_LABEL}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Contract</dt>
                    <dd className="mono" title={ACCEPTANCE_CONTRACT}>
                      {ACCEPTANCE_CONTRACT || 'Not configured'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Wallet</dt>
                    <dd className="mono">
                      {account ? shortAddress(account) : 'not connected'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5B6068]">Ready</dt>
                    <dd>{ACCEPTANCE_CONTRACT ? 'signing unavailable' : 'deployment unavailable'}</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        ) : null}

        {view === 'track' ? (
          <div className="max-w-[720px]">
            <h1 className="text-xl font-semibold tracking-tight">
              Track a transaction
            </h1>
            <p className="mt-1 max-w-[600px] text-[15px] text-[#5B6068]">
              Follow any Bradbury transaction from submission to a
              finalized, successful receipt.
            </p>
            <div className="mt-6"><TxTracker /></div>
          </div>
        ) : null}

        {view === 'history' ? <HistoryView /> : null}
      </main>
    </>
  );
}
