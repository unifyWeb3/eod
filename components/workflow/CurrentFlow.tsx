import fs from 'node:fs';
import path from 'node:path';
import NewJobPanel from '../NewJobPanel';
import { ACCEPTANCE_CONTRACT, BASE_EXPLORER, GL_EXPLORER } from '../../lib/genlayer';

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

function txLinks(hashes: (string | undefined)[], base: string) {
  return hashes
    .filter((h): h is string => !!h && h.length > 20 && h !== 'adopted-after-502')
    .map((h) => (
      <span key={h} style={{ marginRight: 8 }}>
        <a href={`${base}/tx/${h}`} target="_blank" rel="noreferrer">
          {h.slice(0, 10)}…
        </a>
      </span>
    ));
}

const ORDER = ['pass', 'structural', 'semantic', 'undetermined6'];
const LABELS: Record<string, string> = {
  pass: '1 · pass → ACCEPT → release',
  structural: '2 · structural fail → deterministic gate (no LLM, no escrow)',
  semantic: '3 · semantic fail → REJECT → refund',
  undetermined6: '4 · ambiguous → validators resolve strictly (UNDETERMINED stays code-complete)',
};

export default function CurrentFlow() {
  const fixtures = loadFixtures();
  return (
    <>
      <section>
        <h2>Contract</h2>
        <p>
          Acceptance{' '}
          <a
            href={`${GL_EXPLORER}/address/${ACCEPTANCE_CONTRACT}`}
            target="_blank"
            rel="noreferrer"
          >
            {ACCEPTANCE_CONTRACT}
          </a>{' '}
          · studio-dev (chain 61997)
        </p>
      </section>
      <section>
        <h2>Four-fixture demo (real onchain history)</h2>
        {ORDER.map((name) => {
          const f = fixtures[name];
          if (!f) return <p key={name}>missing fixture: {name}</p>;
          return (
            <article
              key={name}
              style={{ border: '1px solid #ccc', padding: 12, margin: '12px 0' }}
            >
              <h3>{LABELS[name]}</h3>
              <p>
                job {f.job_id} · verdict <strong>{f.verdict ?? 'gate-rejected'}</strong>
                {f.receipt ? ` · receipt ${f.receipt}` : ''}
              </p>
              {f.rationale ? <p>rationale: {f.rationale}</p> : null}
              <p>
                GenLayer:{' '}
                {txLinks([f.create_tx, f.submit_tx, f.eval_tx], GL_EXPLORER)}
              </p>
              {f.escrow ? (
                <p>
                  escrow{' '}
                  <a
                    href={`${BASE_EXPLORER}/address/${f.escrow}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.escrow.slice(0, 10)}…
                  </a>{' '}
                  {f.settle_kind ? `· ${f.settle_kind} ` : ''}
                  {txLinks([f.escrow_tx, f.settle_tx], BASE_EXPLORER)}
                </p>
              ) : (
                <p>no escrow (stopped at deterministic gate)</p>
              )}
              <p>
                {[f.create_s, f.submit_s, f.eval_s]
                  .filter((n) => typeof n === 'number')
                  .join('s / ')}
                {typeof f.eval_s === 'number' ? 's' : ''}
              </p>
            </article>
          );
        })}
      </section>
      <section>
        <h2>New job (browser wallet, studio-dev)</h2>
        <NewJobPanel />
      </section>
    </>
  );
}
