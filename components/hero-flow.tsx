import Link from 'next/link';
import { buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

export function Hero() {
  return (
    <div className="border-b border-[#E8E6E1]">
      <div className="mx-auto max-w-[1120px] px-6 pb-20 pt-16 md:pb-28 md:pt-24">
        <p className="mb-5 inline-block rounded-full border border-[#E8E6E1] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#1E40AF]">
          Verdict infrastructure for agentic work
        </p>
        <h1 className="max-w-[760px] text-4xl font-semibold leading-[1.08] md:text-[56px]">
          Turn subjective work acceptance into an onchain receipt.
        </h1>
        <p className="mt-6 max-w-[620px] text-lg leading-relaxed text-[#5B6068]">
          Define what “done” means before work begins. EOD uses
          deterministic checks and GenLayer consensus to produce a finalized
          verdict that payment systems can act on.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/app"
            className={cn(buttonVariants({ variant: 'primary' }), 'px-6')}
          >
            Launch app
          </Link>
          <Link
            href="#proof"
            className={cn(buttonVariants({ variant: 'secondary' }), 'px-6')}
          >
            View live proof
          </Link>
        </div>
      </div>
    </div>
  );
}

const STAGES = [
  {
    n: '01',
    title: 'Policy',
    body: 'The buyer writes what “done” means as versioned acceptance criteria — before work begins.',
  },
  {
    n: '02',
    title: 'Deterministic gates',
    body: 'Schema, hashes, and sources are checked by code. Malformed work stops here; no LLM is spent.',
  },
  {
    n: '03',
    title: 'GenLayer consensus',
    body: 'Only the subjective remainder goes to independent validators, who must agree exactly.',
  },
  {
    n: '04',
    title: 'Finalized receipt',
    body: 'Every job ends in ACCEPT, REJECT, or UNDETERMINED — machine-readable and final.',
  },
  {
    n: '05',
    title: 'Settlement',
    body: 'Payment systems release on ACCEPT, refund on REJECT, and hold on UNDETERMINED.',
  },
];

export function FlowStepper() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[10px] border border-[#E8E6E1] bg-[#E8E6E1] sm:grid-cols-2 lg:grid-cols-5">
      {STAGES.map((s, i) => (
        <li
          key={s.n}
          className="group relative bg-white p-5 transition-colors duration-150 hover:bg-[#F4F3F0]"
        >
          <p className="mono text-xs text-[#5B6068]">{s.n}</p>
          <h3 className="mt-2 text-[15px] font-semibold">{s.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#5B6068]">
            {s.body}
          </p>
          {i < STAGES.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute right-3 top-5 hidden text-[#5B6068]/40 lg:inline"
            >
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
