import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLiveJobs, receiptLabel, FINAL_READ_VARIANT } from '../lib/live-jobs.mjs';

const ADDRESS = '0x1234567890123456789012345678901234567890';
const RECEIPT = `0x${'ab'.repeat(32)}`;

function clientWith(jobs, receipts, count = Object.keys(jobs).length) {
  const calls = [];
  return {
    calls,
    async getContractCode(address) {
      assert.equal(address, ADDRESS);
      return 'acceptance-contract-source';
    },
    async getContractSchema(address) {
      assert.equal(address, ADDRESS);
      return { methods: Object.fromEntries(['get_job_count', 'get_job', 'get_receipt'].map((name) => [name, { readonly: true }])) };
    },
    async readContract(request) {
      calls.push(request);
      assert.equal(request.address, ADDRESS);
      assert.equal(request.transactionHashVariant, FINAL_READ_VARIANT);
      if (request.functionName === 'get_job_count') return count;
      const jobId = request.args[0];
      if (request.functionName === 'get_job') return JSON.stringify(jobs[jobId]);
      if (request.functionName === 'get_receipt') return receipts[jobId] ?? '';
      throw new Error(`unexpected getter ${request.functionName}`);
    },
  };
}

test('reads job count, job JSON, and finalized receipt from the target contract', async () => {
  const client = clientWith({
    'job-2': { id: 'job-2', buyer: '0xbuyer', seller: '0xseller', status: 'ACCEPT', verdict: 'ACCEPT', receipt: RECEIPT },
    'job-1': { id: 'job-1', status: 'OPEN', receipt: '' },
  }, { 'job-2': RECEIPT }, 2);
  const result = await loadLiveJobs({ client, address: ADDRESS });
  assert.equal(result.count, '2');
  assert.deepEqual(result.jobs.map((entry) => entry.job.id), ['job-2', 'job-1']);
  assert.equal(result.jobs[0].receipt, RECEIPT);
  assert.equal(result.jobs[1].receipt, '');
  assert.equal(client.calls[0].functionName, 'get_job_count');
  assert.equal(client.calls.filter((call) => call.functionName === 'get_job').length, 2);
  assert.equal(client.calls.filter((call) => call.functionName === 'get_receipt').length, 2);
});

test('retries the job and receipt pair when finalized state changes between reads', async () => {
  const client = clientWith({
    'job-1': { id: 'job-1', status: 'ACCEPT', receipt: RECEIPT },
  }, { 'job-1': RECEIPT }, 1);
  let jobReads = 0;
  client.readContract = async (request) => {
    client.calls.push(request);
    if (request.functionName === 'get_job_count') return 1;
    if (request.functionName === 'get_receipt') return RECEIPT;
    if (request.functionName === 'get_job') {
      jobReads += 1;
      return JSON.stringify({ id: 'job-1', status: 'ACCEPT', receipt: jobReads === 1 ? '' : RECEIPT });
    }
    throw new Error(`unexpected getter ${request.functionName}`);
  };

  const result = await loadLiveJobs({ client, address: ADDRESS });
  assert.equal(result.jobs[0].receipt, RECEIPT);
  assert.equal(client.calls.filter((call) => call.functionName === 'get_job').length, 2);
  assert.equal(client.calls.filter((call) => call.functionName === 'get_receipt').length, 2);
});

test('shows an unavailable error after a bounded number of receipt-pair mismatches', async () => {
  const client = clientWith({
    'job-1': { id: 'job-1', status: 'ACCEPT', receipt: '' },
  }, { 'job-1': RECEIPT }, 1);
  await assert.rejects(
    loadLiveJobs({ client, address: ADDRESS }),
    /finalized receipt for job-1 changed during reads/,
  );
  assert.equal(client.calls.filter((call) => call.functionName === 'get_job').length, 3);
  assert.equal(client.calls.filter((call) => call.functionName === 'get_receipt').length, 3);
});

test('no configured address and missing contract code report deployment unavailable', async () => {
  await assert.rejects(loadLiveJobs({ client: clientWith({}, {}), address: '' }), /No verified acceptance deployment/);
  const client = clientWith({}, {});
  client.getContractCode = async () => '';
  await assert.rejects(loadLiveJobs({ client, address: ADDRESS }), /No contract code/);
  assert.equal(client.calls.length, 0);
  const incompatible = clientWith({}, {});
  incompatible.getContractSchema = async () => ({ methods: {} });
  await assert.rejects(loadLiveJobs({ client: incompatible, address: ADDRESS }), /does not expose/);
  assert.equal(incompatible.calls.length, 0);
});

test('RPC read failures remain unavailable errors and are not converted to empty history', async () => {
  const client = clientWith({}, {});
  client.readContract = async () => { throw new Error('Bradbury RPC unavailable'); };
  await assert.rejects(loadLiveJobs({ client, address: ADDRESS }), /Bradbury RPC unavailable/);
});

test('receipt view formats an actual receipt and clearly marks the empty case', () => {
  assert.equal(receiptLabel(RECEIPT), RECEIPT);
  assert.equal(receiptLabel(''), 'No finalized receipt');
});
