import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, stringToHex } from 'viem';
import {
  acceptanceCallPreview,
  actionAuthorization,
  buildEvidenceEnvelope,
  classifyEvaluationTransaction,
  classifySettlement,
  loadEscrowSnapshot,
  validateEnvelopeAgainstManifest,
  assertReceiptPair,
  WorkflowIntegrityError,
  WorkflowUnavailable,
} from '../lib/job-workflow.mjs';

const BUYER = '0x1111111111111111111111111111111111111111';
const SELLER = '0x2222222222222222222222222222222222222222';
const OTHER = '0x3333333333333333333333333333333333333333';
const ACCEPTANCE = '0x4444444444444444444444444444444444444444';
const FACTORY = '0x5555555555555555555555555555555555555555';
const ESCROW = '0x6666666666666666666666666666666666666666';
const BASE = `https://raw.githubusercontent.com/eod/acceptance/${'ab'.repeat(20)}/evidence`;
const POLICY = 'a1'.repeat(32);
const EVIDENCE = 'b2'.repeat(32);
const RECEIPT = `0x${'c3'.repeat(32)}`;
const AMOUNT = 900n;

function job(overrides = {}) {
  return {
    id: 'job-9', buyer: BUYER, seller: SELLER, status: 'READY', verdict: 'ACCEPT',
    policy_commitment: POLICY, evidence_commitment: EVIDENCE,
    funded_amount: AMOUNT.toString(), escrow: ESCROW, receipt: RECEIPT,
    ...overrides,
  };
}

test('role and lifecycle gates authorize only the seller to submit and only the buyer for buyer actions', () => {
  const open = job({ status: 'OPEN', verdict: '' });
  assert.equal(actionAuthorization(open, BUYER, 'submit').authorized, false);
  assert.equal(actionAuthorization(open, OTHER, 'submit').authorized, false);
  assert.equal(actionAuthorization(open, SELLER, 'submit').authorized, true);
  assert.equal(actionAuthorization(job(), SELLER, 'submit').authorized, false);
  assert.equal(actionAuthorization(job({ status: 'SUBMITTED' }), BUYER, 'commit').authorized, true);
  assert.equal(actionAuthorization(job({ status: 'SUBMITTED' }), SELLER, 'commit').authorized, false);
  assert.equal(actionAuthorization(job({ status: 'EVIDENCE_COMMITTED' }), BUYER, 'deploy').authorized, true);
  assert.equal(actionAuthorization(job({ status: 'READY' }), BUYER, 'evaluate').authorized, true);
});

test('evidence builder hashes exact bytes and manifest comparison rejects altered bytes or metadata', () => {
  const bytes = new TextEncoder().encode('the delivered file bytes');
  const envelope = buildEvidenceEnvelope({ artifacts: [{ id: 'artifact-1', bytes }], evidenceBaseUrl: BASE });
  const artifact = envelope.artifacts[0];
  assert.match(artifact.digest, /^keccak256:[0-9a-f]{64}$/);
  assert.equal(artifact.source, `${BASE}/keccak256/${artifact.digest.slice(10)}.txt`);
  const manifest = { version: 1, artifacts: [{ ...artifact, bytes: bytes.length }], total_bytes: bytes.length };
  assert.equal(validateEnvelopeAgainstManifest(envelope, manifest, BASE), true);

  const changed = buildEvidenceEnvelope({ artifacts: [{ id: 'artifact-1', bytes: new TextEncoder().encode('changed file bytes') }], evidenceBaseUrl: BASE });
  assert.throws(() => validateEnvelopeAgainstManifest(changed, manifest, BASE), WorkflowIntegrityError);
  const substitutedSource = structuredClone(envelope);
  substitutedSource.artifacts[0].source = 'https://example.invalid/content.txt';
  assert.throws(() => validateEnvelopeAgainstManifest(substitutedSource, manifest, BASE), /source or media type is incorrect/);

  const secondBytes = new TextEncoder().encode('another artifact with longer bytes');
  const pair = buildEvidenceEnvelope({ artifacts: [
    { id: 'artifact-a', bytes },
    { id: 'artifact-b', bytes: secondBytes },
  ], evidenceBaseUrl: BASE });
  const pairManifest = {
    version: 1,
    artifacts: [
      { ...pair.artifacts[0], bytes: bytes.length },
      { ...pair.artifacts[1], bytes: secondBytes.length },
    ],
    total_bytes: bytes.length + secondBytes.length,
  };
  assert.equal(validateEnvelopeAgainstManifest(pair, pairManifest, BASE), true);
  const duplicateManifestId = {
    ...pairManifest,
    artifacts: [pairManifest.artifacts[0], pairManifest.artifacts[0]],
    total_bytes: bytes.length * 2,
  };
  assert.throws(() => validateEnvelopeAgainstManifest(pair, duplicateManifestId, BASE), /duplicate artifact IDs/);
  assert.throws(() => validateEnvelopeAgainstManifest(pair, {
    ...pairManifest,
    artifacts: [pairManifest.artifacts[0]],
    total_bytes: bytes.length,
  }, BASE), /does not cover the envelope/);

  const submitPreview = acceptanceCallPreview('submit_deliverable', ['job-9', JSON.stringify(pair)]);
  assert.equal(typeof submitPreview.args[1], 'string');
  assert.throws(() => acceptanceCallPreview('submit_deliverable', ['job-9', pair]), /contract signature/);
  const createPreview = acceptanceCallPreview('create_job', ['{"criteria":[]}', SELLER]);
  assert.equal(typeof createPreview.args[0], 'string');
  assert.equal(createPreview.args[1], SELLER);
  assert.throws(() => acceptanceCallPreview('create_job', [{ criteria: [] }, SELLER]), /contract signature/);
});

test('evidence builder fails closed on unavailable configuration, invalid UTF-8, oversize and duplicate IDs', () => {
  assert.throws(() => buildEvidenceEnvelope({ artifacts: [{ id: 'a', bytes: new Uint8Array([0xff]) }], evidenceBaseUrl: '' }), /Evidence base/);
  assert.throws(() => buildEvidenceEnvelope({ artifacts: [{ id: 'a', bytes: new Uint8Array([0xff]) }], evidenceBaseUrl: BASE }), /valid UTF-8/);
  assert.throws(() => buildEvidenceEnvelope({ artifacts: [{ id: 'a', bytes: new Uint8Array(4097) }], evidenceBaseUrl: BASE }), /1–4096 bytes/);
  assert.throws(() => buildEvidenceEnvelope({ artifacts: [{ id: 'same', bytes: new Uint8Array([65]) }, { id: 'same', bytes: new Uint8Array([66]) }], evidenceBaseUrl: BASE }), /unique/);
  assert.throws(() => buildEvidenceEnvelope({ artifacts: Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, bytes: new Uint8Array([65]) })), evidenceBaseUrl: BASE }), /1 and 4/);
});

test('job receipt and separate receipt view must match exactly', () => {
  assert.equal(assertReceiptPair(job(), RECEIPT), true);
  assert.throws(() => assertReceiptPair(job(), `0x${'dd'.repeat(32)}`), /differs from the receipt stored/);
  assert.throws(() => assertReceiptPair(job({ receipt: 'invalid' }), RECEIPT), /malformed/);
  assert.throws(() => assertReceiptPair(job({ receipt: '' }), ''), /missing its bound receipt/);
});

test('evaluation display separates finalization from execution success', () => {
  assert.equal(classifyEvaluationTransaction(null).state, 'unobserved');
  assert.equal(classifyEvaluationTransaction({ lifecycle: { state: 'processing' } }).state, 'pending');
  const failed = classifyEvaluationTransaction({ lifecycle: { state: 'finalized' }, txExecutionResultName: 'FINISHED_WITH_ERROR' });
  assert.equal(failed.state, 'failed');
  assert.match(failed.label, /does not prove|execution result/);
  assert.equal(classifyEvaluationTransaction({ lifecycle: { state: 'finalized' }, txExecutionResultName: 'FINISHED_WITH_RETURN' }).state, 'successful');
});

test('successful parent with no escrow claim remains settlement-unobserved; UNDETERMINED is a no-payment hold', () => {
  const unobserved = classifySettlement({ verdict: 'ACCEPT', snapshot: { settled: false, claimRecorded: false } });
  assert.equal(unobserved.state, 'unobserved');
  assert.match(unobserved.label, /does not prove external delivery/);
  assert.equal(classifySettlement({ verdict: 'UNDETERMINED', snapshot: null }).state, 'hold');
  assert.equal(actionAuthorization(job({ status: 'UNDETERMINED', verdict: 'UNDETERMINED' }), BUYER, 'withdraw').authorized, false);
  assert.throws(() => classifySettlement({ verdict: 'UNDETERMINED', snapshot: { settled: true, claimRecorded: true } }), WorkflowIntegrityError);
});

function escrowClient({ mapping = ESCROW, overrides = {}, expectedReceipt = RECEIPT, chainId = 4221n, blockNumber = 1000n, claimOverride, balance } = {}) {
  const values = {
    buyer: BUYER, seller: SELLER, authorizedSource: ACCEPTANCE,
    sourceChainId: 4221n, settlementChainId: 4221n,
    jobId: keccak256(stringToHex('EOD-JOB-V2:job-9')), policyCommitment: `0x${POLICY}`, evidenceCommitment: `0x${EVIDENCE}`,
    fundedAmount: AMOUNT, readyForSettlement: false, settled: true, claimRecorded: true, paid: false,
    outcome: 0, settlementDestination: SELLER, receiptCommitment: RECEIPT,
    ...overrides,
  };
  return {
    calls: [],
    balanceCalls: [],
    blockNumberReads: 0,
    async getChainId() { return chainId; },
    async getBlockNumber() { this.blockNumberReads += 1; return blockNumber; },
    async getBalance(request) {
      this.balanceCalls.push(request);
      return balance ?? (values.paid ? 0n : AMOUNT);
    },
    async readContract(request) {
      this.calls.push(request);
      if (request.functionName === 'deploymentKey') return `0x${'77'.repeat(32)}`;
      if (request.functionName === 'escrowForKey') return mapping;
      if (request.functionName === 'expectedReceipt') return expectedReceipt;
      if (request.functionName === 'claimable') {
        if (claimOverride !== undefined) return claimOverride;
        return values.claimRecorded && !values.paid && request.args[0].toLowerCase() === SELLER.toLowerCase() ? AMOUNT : 0n;
      }
      if (Object.hasOwn(values, request.functionName)) return values[request.functionName];
      throw new Error(`unexpected getter ${request.functionName}`);
    },
  };
}

test('escrow view verifies factory provenance and all immutable bindings with mocked public reads', async () => {
  const client = escrowClient();
  const snapshot = await loadEscrowSnapshot({ client, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER });
  assert.equal(snapshot.accountClaim, AMOUNT);
  assert.equal(snapshot.expectedReceipt, RECEIPT);
  assert.equal(snapshot.readBlockNumber, 1000n);
  assert.equal(client.blockNumberReads, 1);
  assert.ok(client.calls.length > 0);
  assert.ok(client.calls.every((request) => request.blockNumber === snapshot.readBlockNumber));
  assert.deepEqual(client.balanceCalls, [{ address: ESCROW, blockNumber: snapshot.readBlockNumber }]);
  assert.ok(client.calls.some(({ functionName }) => functionName === 'escrowForKey'));

  await assert.rejects(loadEscrowSnapshot({
    client: escrowClient({ mapping: OTHER }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE,
    chainId: 4221, job: job(), account: SELLER,
  }), /does not bind this escrow/);
});

test('escrow view rejects wrong network, immutable binding, and receipt', async () => {
  await assert.rejects(loadEscrowSnapshot({ client: escrowClient({ chainId: 84532n }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), WorkflowUnavailable);
  const noBalanceRead = escrowClient();
  delete noBalanceRead.getBalance;
  await assert.rejects(loadEscrowSnapshot({ client: noBalanceRead, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /read client is unavailable/);
  const noBlockRead = escrowClient();
  delete noBlockRead.getBlockNumber;
  await assert.rejects(loadEscrowSnapshot({ client: noBlockRead, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /read client is unavailable/);
  await assert.rejects(loadEscrowSnapshot({ client: escrowClient({ blockNumber: 1000 }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /invalid block number/);
  await assert.rejects(loadEscrowSnapshot({ client: escrowClient({ overrides: { seller: OTHER } }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /seller does not match/);
  await assert.rejects(loadEscrowSnapshot({ client: escrowClient({ expectedReceipt: `0x${'88'.repeat(32)}` }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /receipt does not match/);
  await assert.rejects(loadEscrowSnapshot({ client: escrowClient({ balance: 1n }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER }), /balance is below its funded amount/);
});

test('settlement without a recorded claim remains a failure-to-observe, never a completed payment', async () => {
  const client = escrowClient({ overrides: { settled: false, claimRecorded: false, paid: false, outcome: 0, settlementDestination: '0x0000000000000000000000000000000000000000', receiptCommitment: `0x${'00'.repeat(32)}` } });
  const snapshot = await loadEscrowSnapshot({ client, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER });
  assert.equal(classifySettlement({ verdict: 'ACCEPT', snapshot }).state, 'unobserved');
  assert.equal(snapshot.paid, false);
});

test('UNDETERMINED escrow view must show its computed receipt and no payment state', async () => {
  const undetermined = job({ status: 'UNDETERMINED', verdict: 'UNDETERMINED' });
  const client = escrowClient({ overrides: {
    settled: false, claimRecorded: false, paid: false,
    settlementDestination: '0x0000000000000000000000000000000000000000',
    receiptCommitment: `0x${'00'.repeat(32)}`,
  } });
  const snapshot = await loadEscrowSnapshot({ client, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: undetermined, account: BUYER });
  assert.equal(classifySettlement({ verdict: 'UNDETERMINED', snapshot }).state, 'hold');
  assert.equal(snapshot.expectedReceipt, RECEIPT);
  assert.equal(snapshot.claimRecorded, false);
});

test('completed withdrawal requires a paid flag and a cleared claim balance', async () => {
  const client = escrowClient({ overrides: { paid: true } });
  const snapshot = await loadEscrowSnapshot({ client, factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE, chainId: 4221, job: job(), account: SELLER });
  assert.equal(snapshot.sellerClaim, 0n);
  assert.equal(classifySettlement({ verdict: 'ACCEPT', snapshot }).state, 'paid');
  await assert.rejects(loadEscrowSnapshot({
    client: escrowClient({ claimOverride: 0n }), factoryAddress: FACTORY, acceptanceAddress: ACCEPTANCE,
    chainId: 4221, job: job(), account: SELLER,
  }), /claimable balance/);
});
