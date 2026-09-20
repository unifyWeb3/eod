import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import { CANONICAL_PROOF, shortHash } from '../lib/canonical-proof';

function with0x(h: string): `0x${string}` {
  return (h.startsWith('0x') ? h : `0x${h}`) as `0x${string}`;
}

function TxLink({
  href,
  hash,
  label,
}: {
  href: string;
  hash: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-[#5B6068]">{label}</span>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mono text-[#1E40AF] hover:underline"
      >
        {shortHash(hash)}
      </a>
    </div>
  );
}

export function ProofSection() {
  const p = CANONICAL_PROOF;
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="p-0 lg:col-span-3">
        <div className="flex items-center justify-between border-b border-[#E8E6E1] px-6 py-4">
          <p className="mono text-sm font-semibold">{p.jobId}</p>
          <Badge tone="accept">ACCEPT</Badge>
        </div>
        <dl className="space-y-4 px-6 py-6">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B6068]">
              Authoritative receipt
            </dt>
            <dd className="mono mt-1 text-[15px]">{p.receipt}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B6068]">
              Settlement
            </dt>
            <dd className="mt-1 text-[15px] font-semibold text-[#15803D]">
              RELEASE · {p.escrowAmountEth} ETH escrowed
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B6068]">
              Seller balance
            </dt>
            <dd className="tnum mt-1 text-[15px]">
              {p.sellerBeforeEth} → {p.sellerAfterEth} ETH (
              {p.sellerDeltaEth} ETH)
            </dd>
          </div>
          <Separator />
          <p className="text-sm leading-relaxed text-[#5B6068]">
            “{p.rationale}”
          </p>
        </dl>
      </Card>
      <div className="lg:col-span-2">
        <details className="group rounded-[10px] border border-[#E8E6E1] bg-white">
          <summary className="cursor-pointer list-none rounded-[10px] px-6 py-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="inline-flex min-h-[44px] items-center gap-2">
              <span aria-hidden="true" className="transition-transform duration-150 group-open:rotate-90">
                →
              </span>
              View technical evidence
            </span>
          </summary>
          <div className="border-t border-[#E8E6E1] px-6 py-4">
            <TxLink
              label="create_job"
              hash={p.tx.create}
              href={`${p.explorers.genlayer}/tx/${p.tx.create}`}
            />
            <TxLink
              label="submit_deliverable"
              hash={p.tx.submit}
              href={`${p.explorers.genlayer}/tx/${p.tx.submit}`}
            />
            <TxLink
              label="evaluate"
              hash={p.tx.evaluate}
              href={`${p.explorers.genlayer}/tx/${p.tx.evaluate}`}
            />
            <TxLink
              label="escrow fund"
              hash={p.tx.fund}
              href={`${p.explorers.base}/tx/${with0x(p.tx.fund)}`}
            />
            <TxLink
              label="release"
              hash={p.tx.release}
              href={`${p.explorers.base}/tx/${with0x(p.tx.release)}`}
            />
            <TxLink
              label="escrow contract"
              hash={p.escrow}
              href={`${p.explorers.base}/address/${p.escrow}`}
            />
            <p className="mono mt-3 text-xs text-[#5B6068]">
              Acceptance {p.contract} · {p.chain} (chain {p.chainId})
            </p>
          </div>
        </details>
        <p className="mt-4 text-sm leading-relaxed text-[#5B6068]">
          Every hash above is independently verifiable on the public
          explorers. No step is taken on trust.
        </p>
      </div>
    </div>
  );
}
