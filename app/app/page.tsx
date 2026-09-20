import type { Metadata } from 'next';
import Link from 'next/link';
import CurrentFlow from '../../components/workflow/CurrentFlow';
import { TxTracker } from '../../components/TxTracker';

export const metadata: Metadata = {
  title: 'App — EOD acceptance workflow',
  description:
    'Create acceptance jobs, track GenLayer finality, and inspect verdicts.',
};

export default function AppPage() {
  return (
    <>
      <header className="border-b border-[#E8E6E1]">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6">
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
            EOD · App
          </Link>
          <Link
            href="/"
            className="text-sm text-[#5B6068] hover:text-[#1A1D21]"
          >
            ← Back to overview
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1120px] px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Acceptance workflow
        </h1>
        <p className="mt-2 max-w-[640px] text-[15px] leading-relaxed text-[#5B6068]">
          Create an acceptance job, track it to a finalized GenLayer verdict,
          and inspect the receipt.
        </p>
        <div className="mt-8">
          <CurrentFlow />
        </div>
        <div className="mt-8">
          <TxTracker defaultHash="0x0a53b7dcbe73f98d7ac58c995852a7a1198dd3c760fa77b57b61580939f308aa" />
        </div>
      </main>
    </>
  );
}
