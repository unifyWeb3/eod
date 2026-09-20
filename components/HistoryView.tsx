import fs from 'node:fs';
import path from 'node:path';
import { Badge } from './ui/badge';

type Fixture = {
  job_id?: string;
  verdict?: string;
  receipt?: string;
  rationale?: string;
  create_tx?: string;
  submit_tx?: string;
  eval_tx?: string;
  escrow?: string;
  escrow_tx?: string;
  settle_tx?: string;
  settle_kind?: string;
  create_s?: number;
  submit_s?: number;
  eval_s?: number;
};

const ORDER = ['pass', 'structural', 'semantic', 'undetermined6'] as const;

const PATHS: Record<(typeof ORDER)[number], string> = {
  pass: 'acceptance',
  structural: 'deterministic gate',
  semantic: 'acceptance',
  undetermined6: 'acceptance · ambiguous',
};

function durationOf(f: Fixture): string {
  if (typeof f.eval_s === 'number') return `eval ${f.eval_s}s`;
  return '— (stopped pre-consensus)';
}

function loadFixtures(): Record<string, Fixture> {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'data', 'fixtures.json'),
      'utf8',
    );
    return JSON.parse(raw).fixtures ?? {};
  } catch {
    return {};
  }
}

function txHref(base: string, h: string): string {
  const full = h.startsWith('0x') ? h : `0x${h}`;
  return `${base}/tx/${full}`;
}

const GL = 'https://explorer-studio-dev.genlayer.com';
const BASE = 'https://sepolia.basescan.org';

function verdictBadge(v?: string) {
  if (v === 'ACCEPT') return <Badge tone="accept">ACCEPT</Badge>;
  if (v === 'REJECT') return <Badge tone="reject">REJECT</Badge>;
  if (v === 'UNDETERMINED') return <Badge tone="undetermined">UNDETERMINED</Badge>;
  return <Badge tone="neutral">gate rejected</Badge>;
}

function Evidence({ f }: { f: Fixture }) {
  const rows: Array<{
    label: string;
    value?: string;
    base?: string;
    strong?: boolean;
  }> = [
    { label: 'Rationale', value: f.rationale },
    { label: 'Receipt', value: f.receipt, strong: true },
    { label: 'create_job', value: f.create_tx, base: GL },
    { label: 'submit', value: f.submit_tx, base: GL },
    { label: 'evaluate', value: f.eval_tx, base: GL },
    { label: 'escrow', value: f.escrow, base: BASE + '/address' },
    { label: 'escrow fund', value: f.escrow_tx, base: BASE },
    {
      label: f.settle_kind ? `settle (${f.settle_kind})` : 'settle',
      value: f.settle_tx,
      base: BASE,
      strong: true,
    },
  ];
  return (
    <dl className="mt-2 space-y-2 border-t border-[#E8E6E1] pt-3 text-[13px]">
      {rows.map((r) =>
        r.value ? (
          <div key={r.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B6068]">
              {r.label}
            </dt>
            <dd
              className={
                'mono min-w-0 flex-1 break-all ' +
                (r.strong
                  ? 'text-sm font-semibold text-[#1A1D21]'
                  : r.label === 'Rationale'
                    ? 'font-sans text-sm text-[#1A1D21]'
                    : 'text-xs text-[#5B6068]')
              }
            >
              {r.base ? (
                <a
                  href={
                    r.base.endsWith('/address')
                      ? `${r.base}/${r.value}`
                      : txHref(r.base, r.value)
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={
                    r.strong
                      ? 'text-[#1A1D21] underline decoration-[#E8E6E1] underline-offset-2 hover:decoration-[#1A1D21]'
                      : 'hover:text-[#1A1D21] hover:underline'
                  }
                >
                  {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ) : null,
      )}
    </dl>
  );
}

export function HistoryView() {
  const fixtures = loadFixtures();
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">
        Verified history
      </h1>
      <p className="mt-1 max-w-[640px] text-[15px] text-[#5B6068]">
        Every completed fixture run. Expand a row for rationale, receipts,
        and explorer links.
      </p>

      {/* Desktop table */}
      <table className="mt-6 hidden w-full border-collapse text-left text-sm md:table">
        <thead>
          <tr className="border-b border-[#E8E6E1] text-xs uppercase tracking-[0.1em] text-[#5B6068]">
            <th scope="col" className="py-2 pe-4 font-semibold">Job</th>
            <th scope="col" className="py-2 pe-4 font-semibold">Path</th>
            <th scope="col" className="py-2 pe-4 font-semibold">Verdict</th>
            <th scope="col" className="py-2 pe-4 font-semibold">Settlement</th>
            <th scope="col" className="py-2 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          {ORDER.map((name) => {
            const f = fixtures[name];
            if (!f) return null;
            return (
              <tr key={name} className="border-b border-[#E8E6E1] align-top">
                <td className="mono py-3 pe-4">{f.job_id}</td>
                <td className="py-3 pe-4">{PATHS[name]}</td>
                <td className="py-3 pe-4">{verdictBadge(f.verdict)}</td>
                <td className="py-3 pe-4">
                  {f.settle_kind ? f.settle_kind.toUpperCase() : '—'}
                </td>
                <td className="tnum py-3">{durationOf(f)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile cards + shared expandable evidence */}
      <div className="mt-6 space-y-3 md:hidden">
        {ORDER.map((name) => {
          const f = fixtures[name];
          if (!f) return null;
          return (
            <details
              key={name}
              className="rounded-[10px] border border-[#E8E6E1] bg-white"
            >
              <summary className="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="mono text-sm font-semibold">{f.job_id}</span>
                  {verdictBadge(f.verdict)}
                  <span className="tnum ms-auto text-[13px] text-[#5B6068]">
                    {durationOf(f)}
                  </span>
                </span>
              </summary>
              <div className="border-t border-[#E8E6E1] px-4 py-3 text-sm">
                <p className="text-[#5B6068]">
                  {PATHS[name]} · settlement{' '}
                  {f.settle_kind ? f.settle_kind.toUpperCase() : '—'}
                </p>
                <Evidence f={f} />
              </div>
            </details>
          );
        })}
      </div>

      {/* Desktop expandable evidence */}
      <div className="mt-4 hidden space-y-3 md:block">
        {ORDER.map((name) => {
          const f = fixtures[name];
          if (!f) return null;
          return (
            <details
              key={name}
              className="rounded-[10px] border border-[#E8E6E1] bg-white"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span className="inline-flex min-h-[44px] items-center gap-2">
                  <span aria-hidden="true">→</span> Evidence for {f.job_id} (
                  {f.receipt ?? 'no receipt — stopped at gate'})
                </span>
              </summary>
              <div className="border-t border-[#E8E6E1] px-4 py-3">
                <Evidence f={f} />
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
