'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from 'genlayer-js';
import { createPublicClient, http, isAddress, keccak256, stringToHex } from 'viem';
import { CHAIN, ACCEPTANCE_CONTRACT, ESCROW_FACTORY_CONTRACT, EVIDENCE_BASE_URL, EXPECTED_CHAIN_ID, NETWORK_LABEL, SIGNING_ENABLED, missingWritePrerequisites } from '../lib/genlayer';
import {
  acceptanceCallPreview,
  actionAuthorization,
  buildEvidenceEnvelope,
  classifyEvaluationTransaction,
  classifySettlement,
  loadEscrowSnapshot,
  validateEnvelopeAgainstManifest,
  assertReceiptPair,
} from '../lib/job-workflow.mjs';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';

type WorkflowJob = {
  id: string;
  buyer?: string;
  seller?: string;
  policy_commitment?: string;
  evidence_commitment?: string;
  status: string;
  verdict?: string;
  receipt?: string;
  envelope?: any;
  evidence_manifest?: any;
  escrow?: string;
  funded_amount?: string;
};

type Props = { job: WorkflowJob; receipt: string; account: string | null; onBack: () => void };

const STEPS = [
  ['Create job', 'Buyer binds policy and seller'],
  ['Submit evidence', 'Authorized seller submits envelope'],
  ['Commit evidence', 'Buyer authenticates fetched bytes'],
  ['Deploy and fund', 'Buyer uses the fixed escrow factory'],
  ['Bind escrow', 'Buyer binds the funded escrow'],
  ['Evaluate', 'Buyer requests validator judgment'],
  ['Finalize result', 'Parent finalization and execution result'],
  ['Record claim', 'EVM escrow authenticates the finalized receipt'],
  ['Withdraw', 'Entitled recipient calls withdraw'],
] as const;

function doneStep(status: string, index: number, hasEscrow: boolean, settlement?: string) {
  if (index === 0) return true;
  if (index === 1) return status !== 'OPEN';
  if (index === 2) return ['EVIDENCE_COMMITTED', 'READY', 'ACCEPT', 'REJECT', 'UNDETERMINED'].includes(status);
  if (index === 3) return hasEscrow;
  if (index === 4) return ['READY', 'ACCEPT', 'REJECT', 'UNDETERMINED'].includes(status);
  if (index === 5) return ['ACCEPT', 'REJECT', 'UNDETERMINED'].includes(status);
  if (index === 6) return ['ACCEPT', 'REJECT', 'UNDETERMINED'].includes(status);
  if (index === 7) return settlement === 'claim' || settlement === 'paid' || settlement === 'hold';
  return settlement === 'paid' || settlement === 'hold';
}

export function JobWorkflowPanel({ job, receipt, account, onBack }: Props) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [envelopeText, setEnvelopeText] = useState('');
  const [amountWei, setAmountWei] = useState('');
  const [escrowAddress, setEscrowAddress] = useState('');
  const [evaluationHash, setEvaluationHash] = useState('');
  const [evaluationTx, setEvaluationTx] = useState<any>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [escrowSnapshot, setEscrowSnapshot] = useState<any>(null);
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const [escrowLoading, setEscrowLoading] = useState(false);
  const [envelopeError, setEnvelopeError] = useState<string | null>(null);
  const missing = missingWritePrerequisites();

  const envelope = useMemo(() => {
    try { return envelopeText ? JSON.parse(envelopeText) : job.envelope; } catch { return null; }
  }, [envelopeText, job.envelope]);

  const sellerSubmit = actionAuthorization(job, account, 'submit');
  const buyerCommit = actionAuthorization(job, account, 'commit');
  const buyerDeploy = actionAuthorization(job, account, 'deploy');
  const buyerBind = actionAuthorization(job, account, 'bind');
  const buyerEvaluate = actionAuthorization(job, account, 'evaluate');
  const withdrawAuth = actionAuthorization(job, account, 'withdraw', { claimable: escrowSnapshot?.accountClaim ?? 0n });
  const connectedRole = !account ? 'No wallet connected' : account.toLowerCase() === job.buyer?.toLowerCase() ? 'Buyer' : account.toLowerCase() === job.seller?.toLowerCase() ? 'Authorized seller' : 'Unrelated account';
  const factoryJobId = keccak256(stringToHex(`EOD-JOB-V2:${job.id}`));

  useEffect(() => {
    const key = `eod:job-workflow:${job.id}:evaluation`;
    const saved = window.localStorage.getItem(key);
    if (saved && /^0x[0-9a-fA-F]{64}$/.test(saved)) setEvaluationHash(saved);
  }, [job.id]);

  useEffect(() => {
    if (!evaluationHash || !/^0x[0-9a-fA-F]{64}$/.test(evaluationHash)) {
      setEvaluationTx(null);
      setTxError(null);
      return;
    }
    let stopped = false;
    const client = createClient({ chain: CHAIN });
    const read = async () => {
      try {
        const currentChain = BigInt(await client.getChainId());
        if (currentChain !== BigInt(EXPECTED_CHAIN_ID)) throw new Error(`RPC chain ${currentChain} does not match ${EXPECTED_CHAIN_ID}.`);
        const tx = await client.getTransaction({ hash: evaluationHash as any });
        if (!stopped) { setEvaluationTx(tx); setTxError(null); }
      } catch (error: any) {
        if (!stopped) { setEvaluationTx(null); setTxError(String(error?.shortMessage ?? error?.message ?? error)); }
      }
    };
    void read();
    const timer = window.setInterval(() => void read(), 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [evaluationHash]);

  useEffect(() => {
    let stopped = false;
    if (!job.escrow || !ACCEPTANCE_CONTRACT || !ESCROW_FACTORY_CONTRACT || !['ACCEPT', 'REJECT', 'UNDETERMINED'].includes(job.verdict ?? '')) {
      setEscrowSnapshot(null);
      setEscrowError(job.escrow ? 'Unavailable: verified acceptance and factory identities are not configured.' : null);
      return;
    }
    setEscrowLoading(true);
    const client = createPublicClient({ chain: CHAIN, transport: http() });
    void loadEscrowSnapshot({
      client,
      factoryAddress: ESCROW_FACTORY_CONTRACT,
      acceptanceAddress: ACCEPTANCE_CONTRACT,
      chainId: EXPECTED_CHAIN_ID,
      job,
      account,
    }).then((snapshot) => {
      if (!stopped) { setEscrowSnapshot(snapshot); setEscrowError(null); }
    }).catch((error: any) => {
      if (!stopped) { setEscrowSnapshot(null); setEscrowError(String(error?.shortMessage ?? error?.message ?? error)); }
    }).finally(() => { if (!stopped) setEscrowLoading(false); });
    return () => { stopped = true; };
  }, [job, account]);

  let evidenceCheck: string | null = null;
  let evidenceMatches = false;
  if (job.evidence_manifest && envelope) {
    try {
      if (!EVIDENCE_BASE_URL) throw new Error('Evidence base URL is not configured.');
      validateEnvelopeAgainstManifest(envelope, job.evidence_manifest, EVIDENCE_BASE_URL);
      evidenceMatches = true;
    } catch (error: any) {
      evidenceCheck = String(error?.message ?? error);
    }
  }
  let receiptCheck: string | null = null;
  try { assertReceiptPair(job, receipt); } catch (error: any) { receiptCheck = String(error?.message ?? error); }
  const txSummary = classifyEvaluationTransaction(evaluationTx);
  let settlementSummary: { state: string; label: string } | null = null;
  try { settlementSummary = classifySettlement({ verdict: job.verdict, snapshot: escrowSnapshot }); }
  catch (error: any) { settlementSummary = { state: 'error', label: String(error?.message ?? error) }; }

  async function prepareEnvelope() {
    setEnvelopeError(null);
    try {
      if (!EVIDENCE_BASE_URL) throw new Error('No verified evidence repository is configured.');
      if (selectedFiles.length < 1 || selectedFiles.length > 4) throw new Error('Choose between 1 and 4 text artifacts.');
      const artifacts = await Promise.all(selectedFiles.map(async (file, index) => ({
        id: `artifact-${index + 1}`,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })));
      const value = buildEvidenceEnvelope({ artifacts, evidenceBaseUrl: EVIDENCE_BASE_URL });
      setEnvelopeText(JSON.stringify(value, null, 2));
    } catch (error: any) {
      setEnvelopeText('');
      setEnvelopeError(String(error?.message ?? error));
    }
  }

  function storeEvaluationHash() {
    if (!/^0x[0-9a-fA-F]{64}$/.test(evaluationHash)) {
      setTxError('Enter a full transaction hash.');
      return;
    }
    window.localStorage.setItem(`eod:job-workflow:${job.id}:evaluation`, evaluationHash);
  }

  const validWei = /^(0|[1-9][0-9]*)$/.test(amountWei) && BigInt(amountWei || '0') > 0n;
  const bindAddress = escrowAddress || job.escrow || '';
  const bindCallPreview = isAddress(bindAddress)
    ? acceptanceCallPreview('bind_escrow', [job.id, bindAddress])
    : null;

  return (
    <section aria-labelledby="workflow-title" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 text-sm text-[#1E40AF] hover:underline">← Jobs</button>
          <h1 id="workflow-title" className="text-xl font-semibold tracking-tight">Workflow · <span className="mono">{job.id}</span></h1>
          <p className="mt-1 text-sm text-[#5B6068]">{NETWORK_LABEL} · live job and finalized receipt reads</p>
        </div>
        <Badge tone={job.verdict === 'ACCEPT' ? 'accept' : job.verdict === 'REJECT' ? 'reject' : job.verdict === 'UNDETERMINED' ? 'undetermined' : 'neutral'}>{job.verdict || job.status}</Badge>
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Job lifecycle">
        {STEPS.map(([label, detail], index) => {
          const complete = doneStep(job.status, index, Boolean(job.escrow), settlementSummary?.state);
          const progressLabel = settlementSummary?.state === 'hold' && index >= 7 ? 'Not applicable' : complete ? 'Recorded' : 'Pending';
          return <li key={label} className={`rounded-lg border px-3 py-3 ${complete ? 'border-[#15803D]/30 bg-[#F0FDF4]' : 'border-[#E8E6E1] bg-white'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">{String(index + 1).padStart(2, '0')} · {progressLabel}</p>
            <p className="mt-1 text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs text-[#5B6068]">{detail}</p>
          </li>;
        })}
      </ol>

      <div className="mt-5 rounded-[10px] border border-[#E8E6E1] bg-[#F4F3F0] px-4 py-4">
        <h2 className="text-sm font-semibold">Parties and commitments</h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Buyer</dt><dd className="mono break-all">{job.buyer || '—'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Authorized seller</dt><dd className="mono break-all">{job.seller || '—'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Policy commitment</dt><dd className="mono break-all">{job.policy_commitment || 'Not committed'}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Evidence commitment</dt><dd className="mono break-all">{job.evidence_commitment || 'Not committed'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Receipt in job and receipt view</dt><dd className="mono mt-1 break-all">{receipt || 'No finalized receipt'}</dd>
            {receiptCheck ? <p role="alert" className="mt-1 text-xs text-[#B91C1C]">Unavailable: {receiptCheck}</p> : null}
          </div>
        </dl>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[#E8E6E1] bg-white p-4" aria-labelledby="seller-action-title">
          <h2 id="seller-action-title" className="text-sm font-semibold">Authorized seller · prepare and submit</h2>
          <p className="mt-1 text-xs text-[#5B6068]">Only the bound seller can submit while this job is OPEN. Files are read locally as exact UTF-8 bytes; this app does not publish them.</p>
          {job.status === 'OPEN' ? <>
            <label htmlFor="evidence-files" className="mt-3 block text-xs font-medium">Artifact files (up to 4, 4096 bytes each; 12000 bytes total)</label>
            <Input id="evidence-files" className="mt-1" type="file" multiple accept="text/plain,.txt" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []).slice(0, 5))} disabled={!sellerSubmit.authorized} />
            <p className="mt-1 text-xs text-[#5B6068]">Prepared IDs are artifact-1 through artifact-4. Publish each exact byte sequence at its digest-addressed URL separately before submission.</p>
            <Button className="mt-3" variant="secondary" onClick={() => void prepareEnvelope()} disabled={!sellerSubmit.authorized || selectedFiles.length === 0}>Prepare evidence envelope</Button>
            <p role="status" className="mt-2 text-xs text-[#5B6068]">{sellerSubmit.reason}</p>
            {envelopeError ? <p role="alert" className="mt-2 text-xs text-[#B91C1C]">{envelopeError}</p> : null}
            {envelopeText ? <>
              <pre className="mono mt-3 max-h-64 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{envelopeText}</pre>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Submission call preview</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify(acceptanceCallPreview('submit_deliverable', [job.id, envelopeText]), null, 2)}</pre></details>
              <Button className="mt-3" disabled title="Signing is disabled until the verified network, identities, and complete fee quotes are configured.">Submit deliverable · signing disabled</Button>
            </> : null}
          </> : <p className="mt-3 text-sm text-[#5B6068]">Job status is {job.status}; seller submission is closed.</p>}
          {job.envelope ? <details className="mt-3"><summary className="cursor-pointer text-xs font-medium">Submitted envelope</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify(job.envelope, null, 2)}</pre></details> : null}
          {evidenceCheck ? <p role="alert" className="mt-3 text-xs text-[#B91C1C]">Evidence metadata check unavailable or failed: {evidenceCheck}</p> : null}
          {evidenceMatches ? <p role="status" className="mt-2 text-xs text-[#15803D]">Submitted envelope metadata matches the committed manifest. This does not refetch or authenticate artifact bytes in the browser.</p> : null}
          {job.evidence_manifest ? <p role="status" className="mt-2 text-xs text-[#5B6068]">The committed manifest is visible. Validator byte retrieval and digest authentication are enforced by the contract; this UI only compares the committed metadata.</p> : null}
        </section>

        <section className="rounded-[10px] border border-[#E8E6E1] bg-white p-4" aria-labelledby="buyer-action-title">
          <h2 id="buyer-action-title" className="text-sm font-semibold">Buyer · commit, fund, bind, evaluate</h2>
          <p className="mt-1 text-xs text-[#5B6068]">The exact contract order is evidence commit → factory deployment and funding → escrow bind → evaluation. This is submission-before-funding.</p>
          <div className="mt-3 space-y-3">
            <p className="rounded-md bg-[#F4F3F0] p-3 text-xs text-[#5B6068]">Connected role: {connectedRole}. Each action is separately checked against the job buyer/seller and current status.</p>
            <div className="rounded-md border border-[#E8E6E1] p-3">
              <p className="text-sm font-medium">1. Commit evidence</p>
              <p className="mt-1 text-xs text-[#5B6068]">{buyerCommit.reason}</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Acceptance call preview</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify(acceptanceCallPreview('commit_evidence', [job.id]), null, 2)}</pre></details>
              <Button className="mt-2" disabled={!SIGNING_ENABLED || !buyerCommit.authorized} title="Signing is disabled until the verified network, identities, and complete fee quotes are configured.">Commit authenticated evidence</Button>
            </div>
            <div className="rounded-md border border-[#E8E6E1] p-3">
              <p className="text-sm font-medium">2. Deploy and fund via the fixed factory</p>
              <label htmlFor="escrow-funding-wei" className="mt-2 block text-xs">Native GEN amount in wei (exact integer)</label>
              <Input id="escrow-funding-wei" className="mono mt-1" inputMode="numeric" value={amountWei} onChange={(event) => setAmountWei(event.target.value)} placeholder="e.g. 1000000000000000000" />
              <p className="mt-1 text-xs text-[#5B6068]">No default amount or fee estimate is provided. Buyer identity is msg.sender at the factory.</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Factory call preview</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify({ functionName: 'deployEscrow', args: [job.seller, ACCEPTANCE_CONTRACT || '(acceptance address not configured)', EXPECTED_CHAIN_ID, EXPECTED_CHAIN_ID, factoryJobId, job.policy_commitment ? `0x${job.policy_commitment.replace(/^0x/, '')}` : '(policy commitment pending)', job.evidence_commitment ? `0x${job.evidence_commitment.replace(/^0x/, '')}` : '(evidence commitment pending)'], value: validWei ? amountWei : '(enter exact wei amount)', buyer: 'msg.sender' }, null, 2)}</pre></details>
              <Button className="mt-2" disabled={!SIGNING_ENABLED || !buyerDeploy.authorized || !validWei} title="Signing is disabled until the verified network, identities, and complete fee quotes are configured.">Deploy and fund bound escrow</Button>
            </div>
            <div className="rounded-md border border-[#E8E6E1] p-3">
              <p className="text-sm font-medium">3. Bind funded escrow</p>
              <label htmlFor="escrow-address" className="mt-2 block text-xs">Factory-deployed escrow address</label>
              <Input id="escrow-address" className="mono mt-1" value={escrowAddress || job.escrow || ''} onChange={(event) => setEscrowAddress(event.target.value.trim())} placeholder="0x…" />
              {bindCallPreview ? <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Acceptance call preview</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify(bindCallPreview, null, 2)}</pre></details> : <p className="mt-1 text-xs text-[#5B6068]">Enter a valid escrow address to preview bind_escrow(job_id: str, escrow: Address).</p>}
              <Button className="mt-2" disabled={!SIGNING_ENABLED || !buyerBind.authorized || !isAddress(escrowAddress || job.escrow || '')} title="Signing is disabled until the verified network, identities, and complete fee quotes are configured.">Bind escrow to job</Button>
            </div>
            <div className="rounded-md border border-[#E8E6E1] p-3">
              <p className="text-sm font-medium">4. Request evaluation</p>
              <p className="mt-1 text-xs text-[#5B6068]">The caller cannot choose ACCEPT, REJECT, destination, or payment action.</p>
              <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Acceptance call preview</summary><pre className="mono mt-2 overflow-auto rounded-md bg-[#F4F3F0] p-3 text-xs">{JSON.stringify(acceptanceCallPreview('evaluate', [job.id]), null, 2)}</pre></details>
              <Button className="mt-2" disabled={!SIGNING_ENABLED || !buyerEvaluate.authorized} title="Signing is disabled until the verified network, identities, and complete fee quotes are configured.">Request evaluation</Button>
            </div>
          </div>
          <p role="status" className="mt-3 rounded-md bg-[#F4F3F0] p-3 text-xs text-[#5B6068]">All write actions are disabled in this build. Missing: {missing.join(', ')}.</p>
        </section>
      </div>

      <section className="mt-5 rounded-[10px] border border-[#E8E6E1] bg-white p-4" aria-labelledby="finality-title">
        <h2 id="finality-title" className="text-sm font-semibold">Finalization, execution, settlement, and withdrawal</h2>
        {['ACCEPT', 'REJECT'].includes(job.verdict ?? '') || job.verdict === 'UNDETERMINED' ? <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-[#F4F3F0] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Parent finalization and execution</p>
              <p className="mt-1 text-sm">{txSummary.label}</p>
              <p className="mt-1 text-xs text-[#5B6068]">This transaction hash is a user-entered reference; verify it is this job&apos;s evaluate call. Parent finalization does not prove external message delivery.</p>
              <label htmlFor="evaluation-transaction-hash" className="mt-3 block text-xs">Evaluation transaction hash</label>
              <div className="mt-1 flex gap-2"><Input id="evaluation-transaction-hash" className="mono min-w-0" value={evaluationHash} onChange={(event) => setEvaluationHash(event.target.value.trim())} placeholder="0x…" /><Button variant="secondary" onClick={storeEvaluationHash} disabled={!/^0x[0-9a-fA-F]{64}$/.test(evaluationHash)}>Save and inspect</Button></div>
              {evaluationTx ? <dl className="mt-2 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-[#5B6068]">Lifecycle</dt><dd>{evaluationTx.lifecycle?.state ?? 'unknown'}</dd></div><div><dt className="text-[#5B6068]">Execution</dt><dd>{evaluationTx.txExecutionResultName ?? 'unknown'}</dd></div><div><dt className="text-[#5B6068]">Transaction status</dt><dd>{evaluationTx.statusName ?? 'unknown'}</dd></div></dl> : null}
              {txError ? <p role="alert" className="mt-2 text-xs text-[#B91C1C]">Transaction read unavailable: {txError}</p> : null}
            </div>
            <div className="rounded-md bg-[#F4F3F0] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Computed outcome</p>
              {job.verdict === 'UNDETERMINED' ? <p role="status" className="mt-1 text-sm font-medium">UNDETERMINED · hold. The contract records a bound no-payment receipt and emits no settlement message.</p> : <p className="mt-1 text-sm">{job.verdict} · destination is fixed by the contract ({job.verdict === 'ACCEPT' ? 'seller' : 'buyer'}). No release/refund selector exists.</p>}
              <p className="mono mt-2 break-all text-xs">{receipt || 'No receipt'}</p>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-[#E8E6E1] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6068]">Escrow settlement and claim</p>
            {escrowLoading ? <p role="status" className="mt-1 text-sm text-[#5B6068]">Reading factory mapping and escrow state…</p> : null}
            {escrowError ? <p role="status" className="mt-1 text-sm text-[#5B6068]">Unavailable: {escrowError}</p> : null}
            {settlementSummary ? <p role="status" className="mt-1 text-sm">{settlementSummary.label}</p> : null}
            {escrowSnapshot ? <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><div><dt className="text-[#5B6068]">EVM read block</dt><dd className="mono">{escrowSnapshot.readBlockNumber.toString()}</dd></div><div><dt className="text-[#5B6068]">Claim recorded</dt><dd>{String(escrowSnapshot.claimRecorded)}</dd></div><div><dt className="text-[#5B6068]">Recipient payment completed</dt><dd>{String(escrowSnapshot.paid)}</dd></div><div><dt className="text-[#5B6068]">Connected account claimable</dt><dd className="mono">{escrowSnapshot.accountClaim.toString()} wei</dd></div><div><dt className="text-[#5B6068]">Escrow funded amount</dt><dd className="mono">{String(escrowSnapshot.fundedAmount)} wei</dd></div><div><dt className="text-[#5B6068]">Escrow balance</dt><dd className="mono">{escrowSnapshot.balance} wei</dd></div><div><dt className="text-[#5B6068]">Destination</dt><dd className="mono break-all">{escrowSnapshot.settlementDestination}</dd></div></dl> : null}
            <p className="mt-2 text-xs text-[#5B6068]">Factory mapping and getters are read from the configured addresses; this does not independently verify deployed bytecode identity. Parent finalization and escrow claim are displayed as separate facts.</p>
            <p className="mt-2 text-xs text-[#5B6068]">{withdrawAuth.reason} Withdrawal remains disabled with all signing in this build.</p>
            {job.verdict === 'UNDETERMINED'
              ? <p role="status" className="mt-2 text-xs text-[#5B6068]">No settlement or withdrawal action is available for UNDETERMINED.</p>
              : <Button className="mt-2" disabled={!SIGNING_ENABLED || !withdrawAuth.authorized} title="Only the claimant can call withdraw; signing is disabled in this build.">Withdraw recorded claim</Button>}
          </div>
        </> : <p className="mt-2 text-sm text-[#5B6068]">Receipt, parent finalization, execution result, and escrow payment state will appear here after evaluation. No verdict is inferred from a local fixture.</p>}
      </section>
    </section>
  );
}
