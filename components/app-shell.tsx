'use client';

import Link from 'next/link';
import { Button } from './ui/button';
import { ACCEPTANCE_CONTRACT, NETWORK_LABEL } from '../lib/genlayer';
import { shortAddress } from '../lib/wallet';

export type AppView = 'create' | 'track' | 'history';

const VIEWS: Array<{ id: AppView; label: string }> = [
  { id: 'create', label: 'Create job' },
  { id: 'track', label: 'Track' },
  { id: 'history', label: 'Jobs & receipts' },
];

export function AppShell({
  view,
  onView,
  account,
  onConnect,
  connecting,
}: {
  view: AppView;
  onView: (v: AppView) => void;
  account: string | null;
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <header className="border-b border-[#E8E6E1]">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <div className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 py-2">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
              aria-label="EOD home"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#1A1D21] font-mono text-[11px] font-bold text-white"
              >
                EOD
              </span>
              <span className="hidden sm:inline">Acceptance</span>
            </Link>
            <span
              className="mono hidden rounded-full border border-[#E8E6E1] bg-white px-2 py-0.5 text-[11px] text-[#5B6068] md:inline"
              title={ACCEPTANCE_CONTRACT}
            >
              {ACCEPTANCE_CONTRACT ? `Contract · ${ACCEPTANCE_CONTRACT}` : 'Contract unavailable'}
            </span>
          </div>
          <nav aria-label="Application views">
            <div
              role="tablist"
              aria-label="Application views"
              className="flex rounded-[7px] border border-[#E8E6E1] bg-white p-1"
            >
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => onView(v.id)}
                  className={
                    'min-h-[40px] rounded-[5px] px-3 text-sm font-medium transition-colors duration-150 sm:px-4 ' +
                    (view === v.id
                      ? 'bg-[#1A1D21] text-white'
                      : 'text-[#5B6068] hover:text-[#1A1D21]')
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E6E1] bg-white px-2.5 py-1 text-xs text-[#5B6068]"
              title={NETWORK_LABEL}
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-[#15803D]"
              />
              Bradbury · 4221
            </span>
            {account ? (
              <span
                className="mono inline-flex min-h-[40px] items-center rounded-[7px] border border-[#E8E6E1] bg-white px-3 text-[13px]"
                title={account}
              >
                {shortAddress(account)}
              </span>
            ) : (
              <Button
                variant="primary"
                onClick={onConnect}
                disabled={connecting}
                className="min-h-[40px] px-4"
              >
                {connecting ? 'Connecting…' : 'Connect wallet'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
