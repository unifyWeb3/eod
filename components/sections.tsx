import Link from 'next/link';
import { Alert } from './ui/alert';
import { Card, CardText, CardTitle } from './ui/card';
import { buttonVariants } from './ui/button';
import { cn } from '../lib/utils';

export function Problem() {
  const items = [
    {
      t: 'Human review doesn’t scale',
      b: 'Machine-speed hiring creates more jobs than any review queue can clear. Good work waits; edge cases rot.',
    },
    {
      t: 'Private LLM signoff isn’t neutral',
      b: 'When one side’s model grades its own homework, the verdict is an opinion — unauditable and easy to bypass.',
    },
    {
      t: 'Support tickets aren’t infrastructure',
      b: 'Platform mediation resolves disputes one by one. It can’t gate settlement for thousands of autonomous jobs.',
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((x) => (
        <Card key={x.t}>
          <CardTitle className="text-[15px]">{x.t}</CardTitle>
          <CardText className="mt-2">{x.b}</CardText>
        </Card>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardTitle className="text-[15px]">Deterministic first</CardTitle>
        <CardText className="mt-2">
          Schema, artifact hashes, and source allowlists are checked by plain
          code. Malformed or incomplete work is rejected in seconds without
          spending any consensus.
        </CardText>
      </Card>
      <Card>
        <CardTitle className="text-[15px]">Consensus only for residue</CardTitle>
        <CardText className="mt-2">
          The genuinely subjective remainder — “does this meet the brief?” —
          goes to independent GenLayer validators who re-judge the evidence
          and must agree exactly. Disagreement fails closed; ambiguity is a
          first-class UNDETERMINED, never a silent pass.
        </CardText>
      </Card>
    </div>
  );
}

export function UseCases() {
  const items = [
    {
      t: 'Agent marketplaces',
      b: 'Settle autonomous jobs against shared acceptance rules.',
    },
    {
      t: 'Bounties & contributor work',
      b: 'Turn qualitative completion criteria into a verdict payment rails can use.',
    },
    {
      t: 'Agent orchestration',
      b: 'Let one system commission another without either side being the sole judge of success.',
    },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((x) => (
        <Card key={x.t}>
          <CardTitle className="text-[15px]">{x.t}</CardTitle>
          <CardText className="mt-2">{x.b}</CardText>
        </Card>
      ))}
    </div>
  );
}

export function Architecture() {
  const rows: Array<[string, string]> = [
    ['Acceptance contract', 'Owns policy, evidence envelope, gates, and the verdict. Holds no funds.'],
    ['GenLayer consensus', 'Independent validators re-judge subjective residue; exact agreement finalizes the receipt.'],
    ['Escrow (external chain)', 'Holds funds and acts only on finalized receipts: release, refund, or hold.'],
    ['App + relayer', 'Submit work, track finality, and settle — gated on receipt, never on trust.'],
  ];
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E8E6E1] bg-white">
      {rows.map(([k, v], i) => (
        <div
          key={k}
          className={cn(
            'grid gap-1 px-6 py-4 md:grid-cols-[220px_1fr] md:gap-6',
            i > 0 && 'border-t border-[#E8E6E1]',
          )}
        >
          <p className="text-sm font-semibold">{k}</p>
          <p className="text-sm leading-relaxed text-[#5B6068]">{v}</p>
        </div>
      ))}
    </div>
  );
}

export function Limitations() {
  return (
    <div className="space-y-3">
      <Alert tone="neutral">
        <strong>Testnets only.</strong> Studio-dev (GenLayer) and Base Sepolia.
        Contracts are unaudited and carry no real value.
      </Alert>
      <Alert tone="undetermined">
        <strong>UNDETERMINED is implemented but untriggered live.</strong>{' '}
        Validators have resolved every ambiguity decisively so far; the branch
        is code-complete, not demoed.
      </Alert>
      <Alert tone="neutral">
        <strong>Operator-key settlement.</strong> Release and refund currently
        execute through one key under strict receipt gating; the allowlisted
        relayer set is a written design, not yet built.
      </Alert>
    </div>
  );
}

export function FinalCta() {
  return (
    <div className="rounded-[10px] border border-[#1A1D21] bg-[#1A1D21] px-6 py-14 text-center md:py-20">
      <h2 className="mx-auto max-w-[560px] text-2xl font-semibold text-white md:text-[32px] md:leading-[1.2]">
        Give every agent job a verdict worth settling on.
      </h2>
      <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-white/70">
        Define “done” up front. Let consensus judge the rest. Settle on the
        receipt.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/app"
          className={cn(
            buttonVariants({ variant: 'secondary' }),
            'border-white/20 bg-white px-6 text-[#1A1D21] hover:bg-white/90',
          )}
        >
          Launch app
        </Link>
        <Link
          href="https://github.com/unifyWeb3/eod"
          className="inline-flex min-h-[44px] items-center px-2 text-sm text-white/70 hover:text-white"
        >
          Read the evidence →
        </Link>
      </div>
    </div>
  );
}
