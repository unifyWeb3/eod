export const FINAL_READ_VARIANT = 'latest-final';
export const MAX_VISIBLE_JOBS = 100;
const READ_BATCH_SIZE = 8;
const MAX_RECEIPT_PAIR_ATTEMPTS = 3;

export class DeploymentUnavailable extends Error {}

function parseJob(value, expectedId) {
  if (typeof value !== 'string') throw new Error(`get_job(${expectedId}) did not return JSON text`);
  let job;
  try {
    job = JSON.parse(value);
  } catch {
    throw new Error(`get_job(${expectedId}) returned malformed JSON`);
  }
  if (!job || typeof job !== 'object' || Array.isArray(job) || job.id !== expectedId) {
    throw new Error(`get_job(${expectedId}) returned an invalid job`);
  }
  return job;
}

function parseReceipt(value, jobId) {
  if (typeof value !== 'string') throw new Error(`get_receipt(${jobId}) did not return text`);
  if (value !== '' && !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`get_receipt(${jobId}) returned an invalid receipt`);
  }
  return value;
}

async function readJobWithReceipt(client, address, jobId) {
  for (let attempt = 0; attempt < MAX_RECEIPT_PAIR_ATTEMPTS; attempt += 1) {
    const [jobValue, receiptValue] = await Promise.all([
      client.readContract({
        address,
        functionName: 'get_job',
        args: [jobId],
        transactionHashVariant: FINAL_READ_VARIANT,
      }),
      client.readContract({
        address,
        functionName: 'get_receipt',
        args: [jobId],
        transactionHashVariant: FINAL_READ_VARIANT,
      }),
    ]);
    const job = parseJob(jobValue, jobId);
    const receipt = parseReceipt(receiptValue, jobId);
    const receiptInJob = parseReceipt(job.receipt, jobId);
    if (receiptInJob.toLowerCase() === receipt.toLowerCase()) return { job, receipt };
  }
  throw new DeploymentUnavailable(`The finalized receipt for ${jobId} changed during reads; refresh and try again.`);
}

export async function loadLiveJobs({ client, address, limit = MAX_VISIBLE_JOBS }) {
  if (!address) throw new DeploymentUnavailable('No verified acceptance deployment is configured.');
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new DeploymentUnavailable('The configured acceptance contract address is invalid.');
  }
  if (!client || typeof client.readContract !== 'function' || typeof client.getContractCode !== 'function') {
    throw new Error('GenLayer read client is unavailable.');
  }

  const code = await client.getContractCode(address);
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new DeploymentUnavailable('No contract code was returned for the configured address.');
  }
  const schema = await client.getContractSchema(address);
  const requiredViews = ['get_job_count', 'get_job', 'get_receipt'];
  if (!schema?.methods || requiredViews.some((name) => schema.methods[name]?.readonly !== true)) {
    throw new DeploymentUnavailable('The configured deployment does not expose the expected read-only acceptance views.');
  }

  const countResult = await client.readContract({
    address,
    functionName: 'get_job_count',
    args: [],
    transactionHashVariant: FINAL_READ_VARIANT,
  });
  let count;
  try {
    const raw = typeof countResult === 'bigint' ? countResult.toString() : String(countResult);
    if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error();
    count = BigInt(raw);
  } catch {
    throw new Error('get_job_count returned an invalid count.');
  }

  const requested = Math.min(Number(count > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : count), limit);
  const ids = Array.from({ length: requested }, (_, index) => `job-${count - BigInt(index)}`);
  const jobs = [];
  for (let offset = 0; offset < ids.length; offset += READ_BATCH_SIZE) {
    const batch = ids.slice(offset, offset + READ_BATCH_SIZE);
    const loaded = await Promise.all(batch.map((jobId) => readJobWithReceipt(client, address, jobId)));
    jobs.push(...loaded);
  }
  return { count: count.toString(), jobs, truncated: BigInt(jobs.length) < count };
}

export function receiptLabel(receipt) {
  return typeof receipt === 'string' && receipt.length > 0 ? receipt : 'No finalized receipt';
}
