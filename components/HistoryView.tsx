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
  const rows: Array<[string, string | undefined, string?]> = [
    ['Rationale', f.rationale],
    ['Receipt', f.receipt],
    ['create_job', f.create_tx, GL],
    ['submit', f.submit_tx, GL],
    ['evaluate', f.eval_tx, GL],
    ['escrow', f.escrow, BASE + '/address'],
    ['escrow fund', f.escrow_tx, BASE],
    [
      f.settle_kind ? `settle (${f.settle_kind})` : 'settle',
      f.settle_tx,
      BASE,
    ],
  ];
  return (
    <dl className="mt-3 space-y-1.5 border-t border-[#E8E6E1] pt-3 text-[13px]">
      {rows.map(([k, v, base]) =>
        v ? (
          <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="w-28 shrink-0 text-[#5B6068]">{k}</dt>
            <dd className="mono min-w-0 flex-1 break-all">
              {base ? (
                <a
                  href={
                    base.endsWith('/address')
                      ? `${base}/${v}`
                      : txHref(base, v)
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#1E40AF] hover:underline"
                >
                  {v}
                </a>
              ) : (
                v
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
