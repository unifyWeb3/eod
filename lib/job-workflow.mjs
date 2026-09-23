import { isAddress, keccak256, stringToHex } from 'viem';

export const WORKFLOW_STATUSES = Object.freeze([
  'OPEN',
  'SUBMITTED',
  'EVIDENCE_COMMITTED',
  'READY',
  'ACCEPT',
  'REJECT',
  'UNDETERMINED',
]);

export const ARTIFACT_LIMITS = Object.freeze({
  count: 4,
  itemBytes: 4096,
  totalBytes: 12000,
  idBytes: 64,
  envelopeBytes: 6000,
});

const MEDIA_TYPE = 'text/plain; charset=utf-8';
const RAW_PREFIX = 'https://raw.githubusercontent.com/';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class WorkflowUnavailable extends Error {}
export class WorkflowIntegrityError extends Error {}

function bytesLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

export function validateEvidenceBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || bytesLength(baseUrl) > 253 || !baseUrl.startsWith(RAW_PREFIX)) {
    throw new Error('Evidence base must use the configured raw.githubusercontent.com path.');
  }
  const parts = baseUrl.slice(RAW_PREFIX.length).split('/');
  if (parts.length !== 4 || parts[3] !== 'evidence') {
    throw new Error('Evidence base must select owner/repo/full-commit/evidence.');
  }
  for (const component of parts.slice(0, 2)) {
    if (!/^[a-z0-9._-]{1,100}$/.test(component)) throw new Error('Evidence repository path is invalid.');
  }
  if (!/^[0-9a-f]{40}$/.test(parts[2])) throw new Error('Evidence base must use a lowercase full commit hash.');
  return baseUrl;
}

export function buildEvidenceEnvelope({ artifacts, evidenceBaseUrl }) {
  validateEvidenceBaseUrl(evidenceBaseUrl);
  if (!Array.isArray(artifacts) || artifacts.length < 1 || artifacts.length > ARTIFACT_LIMITS.count) {
    throw new Error('Choose between 1 and 4 artifacts.');
  }
  const ids = new Set();
  let totalBytes = 0;
  const built = artifacts.map(({ id, bytes }) => {
    if (typeof id !== 'string' || bytesLength(id) < 1 || bytesLength(id) > ARTIFACT_LIMITS.idBytes) {
      throw new Error('Artifact IDs must be 1–64 UTF-8 bytes.');
    }
    if (ids.has(id)) throw new Error('Artifact IDs must be unique.');
    ids.add(id);
    const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (body.byteLength < 1 || body.byteLength > ARTIFACT_LIMITS.itemBytes) {
      throw new Error('Each artifact must be 1–4096 bytes.');
    }
    totalBytes += body.byteLength;
    if (totalBytes > ARTIFACT_LIMITS.totalBytes) throw new Error('Artifacts exceed the 12000-byte total limit.');
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(body);
    } catch {
      throw new Error('Artifacts must contain valid UTF-8.');
    }
    const digestHex = keccak256(body).slice(2);
    return {
      id,
      source: `${evidenceBaseUrl}/keccak256/${digestHex}.txt`,
      digest: `keccak256:${digestHex}`,
      media_type: MEDIA_TYPE,
    };
  });
  const envelope = { artifacts: built };
  if (bytesLength(JSON.stringify(envelope)) > ARTIFACT_LIMITS.envelopeBytes) {
    throw new Error('Evidence envelope exceeds the 6000-byte limit.');
  }
  return envelope;
}

export function validateEnvelopeAgainstManifest(envelope, manifest, evidenceBaseUrl) {
  if (!envelope || !Array.isArray(envelope.artifacts) || !manifest || !Array.isArray(manifest.artifacts)) {
    throw new WorkflowIntegrityError('Evidence envelope or committed manifest is malformed.');
  }
  if (envelope.artifacts.length < 1 || envelope.artifacts.length > ARTIFACT_LIMITS.count || manifest.version !== 1) {
    throw new WorkflowIntegrityError('Evidence artifact count or manifest version is unsupported.');
  }
  try {
    validateEvidenceBaseUrl(evidenceBaseUrl);
  } catch (error) {
    throw new WorkflowIntegrityError(error.message);
  }
  const byId = new Map();
  let total = 0;
  for (const artifact of envelope.artifacts) {
    if (!artifact || typeof artifact.id !== 'string' || bytesLength(artifact.id) < 1 || bytesLength(artifact.id) > ARTIFACT_LIMITS.idBytes || byId.has(artifact.id)) {
      throw new WorkflowIntegrityError('Evidence envelope has missing or duplicate artifact IDs.');
    }
    const digest = artifact.digest;
    if (typeof digest !== 'string' || !/^keccak256:[0-9a-f]{64}$/.test(digest)) {
      throw new WorkflowIntegrityError('Evidence digest is malformed.');
    }
    const expectedSource = `${evidenceBaseUrl}/keccak256/${digest.slice(10)}.txt`;
    if (artifact.source !== expectedSource || artifact.media_type !== MEDIA_TYPE) {
      throw new WorkflowIntegrityError(`Evidence source or media type is incorrect for ${artifact.id}.`);
    }
    byId.set(artifact.id, artifact);
  }
  if (byId.size !== manifest.artifacts.length) throw new WorkflowIntegrityError('Committed manifest does not cover the envelope.');
  const manifestIds = new Set();
  for (const item of manifest.artifacts) {
    if (!item || typeof item.id !== 'string' || bytesLength(item.id) < 1 || bytesLength(item.id) > ARTIFACT_LIMITS.idBytes || manifestIds.has(item.id)) {
      throw new WorkflowIntegrityError('Committed manifest has missing or duplicate artifact IDs.');
    }
    manifestIds.add(item.id);
    const artifact = byId.get(item.id);
    if (!artifact || item.source !== artifact.source || item.digest !== artifact.digest || item.media_type !== artifact.media_type) {
      throw new WorkflowIntegrityError(`Committed evidence differs from the submitted envelope for ${item?.id ?? 'unknown artifact'}.`);
    }
    if (!Number.isInteger(item.bytes) || item.bytes < 1 || item.bytes > ARTIFACT_LIMITS.itemBytes) {
      throw new WorkflowIntegrityError(`Committed byte count is invalid for ${item.id}.`);
    }
    total += item.bytes;
  }
  if (manifestIds.size !== byId.size || [...byId.keys()].some((id) => !manifestIds.has(id))) {
    throw new WorkflowIntegrityError('Committed manifest does not cover every envelope artifact ID.');
  }
  if (total > ARTIFACT_LIMITS.totalBytes || manifest.total_bytes !== total) {
    throw new WorkflowIntegrityError('Committed evidence total byte count is invalid.');
  }
  if (bytesLength(JSON.stringify(envelope)) > ARTIFACT_LIMITS.envelopeBytes) {
    throw new WorkflowIntegrityError('Evidence envelope exceeds the contract byte bound.');
  }
  return true;
}

export function assertReceiptPair(job, receipt) {
  const embedded = job?.receipt;
  const valid = (value) => value === '' || (typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value));
  if (!valid(embedded) || !valid(receipt) || typeof embedded !== 'string' || typeof receipt !== 'string') {
    throw new WorkflowIntegrityError('The job or receipt view is malformed.');
  }
  if (['ACCEPT', 'REJECT', 'UNDETERMINED'].includes(job?.verdict) && embedded === '') {
    throw new WorkflowIntegrityError('A finalized verdict is missing its bound receipt.');
  }
  if (embedded.toLowerCase() !== receipt.toLowerCase()) {
    throw new WorkflowIntegrityError('The live receipt differs from the receipt stored in the job.');
  }
  return true;
}

export function actionAuthorization(job, account, action, { claimable = 0n } = {}) {
  const actor = typeof account === 'string' ? account.toLowerCase() : '';
  const buyer = typeof job?.buyer === 'string' ? job.buyer.toLowerCase() : '';
  const seller = typeof job?.seller === 'string' ? job.seller.toLowerCase() : '';
  const buyerOnly = ['create', 'commit', 'deploy', 'bind', 'evaluate'];
  if (action === 'create') return { authorized: Boolean(actor), reason: actor ? 'Buyer is the connected account.' : 'Connect the buyer wallet to prepare this action.' };
  if (action === 'submit') {
    const authorized = actor !== '' && actor === seller && job?.status === 'OPEN';
    return { authorized, reason: authorized ? 'Connected account is the authorized seller.' : 'Only the authorized seller can submit while the job is OPEN.' };
  }
  if (action === 'withdraw') {
    const authorized = actor !== '' && claimable > 0n;
    return { authorized, reason: authorized ? 'This account has a recorded claim.' : 'Only an account with a recorded claim can withdraw.' };
  }
  if (buyerOnly.includes(action)) {
    const statusByAction = { commit: 'SUBMITTED', deploy: 'EVIDENCE_COMMITTED', bind: 'EVIDENCE_COMMITTED', evaluate: 'READY' };
    const authorized = actor !== '' && actor === buyer && (!statusByAction[action] || job?.status === statusByAction[action]);
    return { authorized, reason: authorized ? 'Connected account is the buyer and the lifecycle is ready.' : 'Only the buyer can take this action at its required lifecycle state.' };
  }
  return { authorized: false, reason: 'Unknown workflow action.' };
}

export function classifyEvaluationTransaction(tx) {
  if (!tx) return { state: 'unobserved', label: 'No evaluation transaction recorded.' };
  const lifecycle = tx.lifecycle?.state ?? tx.lifecycle;
  const result = tx.txExecutionResultName ?? tx.tx_execution_result_name;
  if (lifecycle !== 'finalized') return { state: 'pending', label: `Parent transaction: ${lifecycle ?? tx.statusName ?? 'unknown'}.` };
  if (result !== 'FINISHED_WITH_RETURN') {
    return { state: 'failed', label: `Parent finalized with execution result ${result ?? 'unavailable'}.` };
  }
  return { state: 'successful', label: 'Parent finalized and execution returned successfully; external settlement is checked separately.' };
}

export function classifySettlement({ verdict, snapshot }) {
  if (verdict === 'UNDETERMINED') {
    if (snapshot?.claimRecorded || snapshot?.settled || snapshot?.paid) {
      throw new WorkflowIntegrityError('UNDETERMINED must not have settlement or payment state.');
    }
    return { state: 'hold', label: 'UNDETERMINED hold: no settlement message or payment claim is expected.' };
  }
  if (snapshot && (Boolean(snapshot.claimRecorded) !== Boolean(snapshot.settled) || (snapshot.paid && !snapshot.claimRecorded))) {
    throw new WorkflowIntegrityError('Escrow settlement flags are inconsistent.');
  }
  if (!snapshot || !snapshot.claimRecorded) {
    return { state: 'unobserved', label: 'Settlement claim not observed. Parent finalization alone does not prove external delivery.' };
  }
  if (snapshot.receiptCommitment?.toLowerCase() !== snapshot.expectedReceipt?.toLowerCase()) {
    throw new WorkflowIntegrityError('Escrow receipt commitment does not match the expected bound receipt.');
  }
  if (snapshot.paid) return { state: 'paid', label: 'Recipient withdrawal completed.' };
  return { state: 'claim', label: 'Settlement claim recorded; recipient withdrawal is still pending.' };
}

export const FINALITY_ESCROW_ABI = [
  { type: 'function', name: 'buyer', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'seller', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'authorizedSource', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'sourceChainId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'settlementChainId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'jobId', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'policyCommitment', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'evidenceCommitment', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'fundedAmount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'readyForSettlement', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'settled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'claimRecorded', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'paid', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'outcome', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'settlementDestination', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'receiptCommitment', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'claimable', stateMutability: 'view', inputs: [{ name: 'recipient', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'expectedReceipt', stateMutability: 'view', inputs: [{ name: '_outcome', type: 'uint8' }, { name: '_destination', type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

export const FINALITY_ESCROW_FACTORY_ABI = [
  { type: 'function', name: 'deploymentKey', stateMutability: 'pure', inputs: [
    { name: 'buyer', type: 'address' }, { name: 'seller', type: 'address' }, { name: 'authorizedSource', type: 'address' },
    { name: 'sourceChainId', type: 'uint256' }, { name: 'settlementChainId', type: 'uint256' }, { name: 'jobId', type: 'bytes32' },
    { name: 'policyCommitment', type: 'bytes32' }, { name: 'evidenceCommitment', type: 'bytes32' }, { name: 'amount', type: 'uint256' },
  ], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'escrowForKey', stateMutability: 'view', inputs: [{ name: '', type: 'bytes32' }], outputs: [{ type: 'address' }] },
];

const ACCEPTANCE_PREVIEW_ARGUMENT_TYPES = Object.freeze({
  create_job: ['str', 'Address'],
  submit_deliverable: ['str', 'str'],
  commit_evidence: ['str'],
  bind_escrow: ['str', 'Address'],
  evaluate: ['str'],
});

export function acceptanceCallPreview(functionName, args) {
  const argumentTypes = ACCEPTANCE_PREVIEW_ARGUMENT_TYPES[functionName];
  if (!argumentTypes || !Array.isArray(args) || args.length !== argumentTypes.length) {
    throw new WorkflowIntegrityError(`Arguments do not match the ${functionName} contract signature.`);
  }
  const matchesType = (value, type) => type === 'str'
    ? typeof value === 'string'
    : type === 'Address' && typeof value === 'string' && isAddress(value);
  if (args.some((value, index) => !matchesType(value, argumentTypes[index]))) {
    throw new WorkflowIntegrityError(`Arguments do not match the ${functionName} contract signature.`);
  }
  return { functionName, args: [...args] };
}

function asBytes32(value, label) {
  const normalized = typeof value === 'string' && value.startsWith('0x') ? value : `0x${value ?? ''}`;
  if (!/^0x[0-9a-f]{64}$/i.test(normalized)) throw new WorkflowIntegrityError(`${label} commitment is malformed.`);
  return normalized;
}

export async function loadEscrowSnapshot({ client, factoryAddress, acceptanceAddress, chainId, job, account }) {
  if (!client || typeof client.readContract !== 'function' || typeof client.getChainId !== 'function' || typeof client.getBlockNumber !== 'function' || typeof client.getBalance !== 'function') {
    throw new WorkflowUnavailable('EVM read client is unavailable.');
  }
  if (!isAddress(factoryAddress) || !isAddress(acceptanceAddress) || !isAddress(job?.escrow)) {
    throw new WorkflowUnavailable('Acceptance, factory, or escrow address is not configured.');
  }
  if (!['ACCEPT', 'REJECT', 'UNDETERMINED'].includes(job.verdict)) {
    throw new WorkflowUnavailable('This job has no finalized verdict and receipt yet.');
  }
  const observedChainId = BigInt(await client.getChainId());
  if (observedChainId !== BigInt(chainId)) throw new WorkflowUnavailable(`EVM RPC is on chain ${observedChainId}, expected ${chainId}.`);
  const readBlockNumber = await client.getBlockNumber();
  if (typeof readBlockNumber !== 'bigint' || readBlockNumber < 0n) {
    throw new WorkflowUnavailable('EVM RPC returned an invalid block number for the escrow snapshot.');
  }

  const buyer = job.buyer;
  const seller = job.seller;
  const amount = BigInt(job.funded_amount);
  if (!isAddress(buyer) || !isAddress(seller) || amount <= 0n) throw new WorkflowIntegrityError('Job parties or funded amount are invalid.');
  const jobHash = keccak256(stringToHex(`EOD-JOB-V2:${job.id}`));
  const policy = asBytes32(job.policy_commitment, 'Policy');
  const evidence = asBytes32(job.evidence_commitment, 'Evidence');
  const receipt = asBytes32(job.receipt, 'Receipt');
  const key = await client.readContract({
    address: factoryAddress,
    abi: FINALITY_ESCROW_FACTORY_ABI,
    functionName: 'deploymentKey',
    args: [buyer, seller, acceptanceAddress, observedChainId, observedChainId, jobHash, policy, evidence, amount],
    blockNumber: readBlockNumber,
  });
  const deployed = await client.readContract({
    address: factoryAddress,
    abi: FINALITY_ESCROW_FACTORY_ABI,
    functionName: 'escrowForKey',
    args: [key],
    blockNumber: readBlockNumber,
  });
  if (String(deployed).toLowerCase() !== job.escrow.toLowerCase()) {
    throw new WorkflowIntegrityError('Factory deployment-key lookup does not bind this escrow to the job.');
  }

  const read = (functionName, args = []) => client.readContract({
    address: job.escrow,
    abi: FINALITY_ESCROW_ABI,
    functionName,
    args,
    blockNumber: readBlockNumber,
  });
  const names = [
    'buyer', 'seller', 'authorizedSource', 'sourceChainId', 'settlementChainId', 'jobId', 'policyCommitment',
    'evidenceCommitment', 'fundedAmount', 'readyForSettlement', 'settled', 'claimRecorded', 'paid', 'outcome',
    'settlementDestination', 'receiptCommitment',
  ];
  const values = await Promise.all(names.map((name) => read(name)));
  const state = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const expected = {
    buyer,
    seller,
    authorizedSource: acceptanceAddress,
    sourceChainId: observedChainId,
    settlementChainId: observedChainId,
    jobId: jobHash,
    policyCommitment: policy,
    evidenceCommitment: evidence,
    fundedAmount: amount,
  };
  for (const [keyName, expectedValue] of Object.entries(expected)) {
    const actual = state[keyName];
    const matches = typeof expectedValue === 'string' && expectedValue.startsWith('0x')
      ? String(actual).toLowerCase() === expectedValue.toLowerCase()
      : BigInt(actual) === BigInt(expectedValue);
    if (!matches) throw new WorkflowIntegrityError(`Escrow ${keyName} does not match the acceptance job.`);
  }

  const outcome = job.verdict === 'ACCEPT' ? 0 : job.verdict === 'REJECT' ? 1 : 2;
  const destination = outcome === 0 ? seller : outcome === 1 ? buyer : ZERO_ADDRESS;
  const expectedReceipt = await read('expectedReceipt', [outcome, destination]);
  if (String(expectedReceipt).toLowerCase() !== receipt.toLowerCase()) {
    throw new WorkflowIntegrityError('Acceptance receipt does not match the escrow-computed receipt.');
  }
  const [buyerClaim, sellerClaim, accountClaim, balance] = await Promise.all([
    read('claimable', [buyer]),
    read('claimable', [seller]),
    isAddress(account ?? '') ? read('claimable', [account]) : Promise.resolve(0n),
    client.getBalance({ address: job.escrow, blockNumber: readBlockNumber }),
  ]);
  const snapshot = {
    ...state,
    readBlockNumber,
    buyerClaim: BigInt(buyerClaim),
    sellerClaim: BigInt(sellerClaim),
    accountClaim: BigInt(accountClaim),
    balance: BigInt(balance),
    expectedReceipt: String(expectedReceipt),
  };
  if (snapshot.balance !== null && !snapshot.paid && snapshot.balance < amount) {
    throw new WorkflowIntegrityError('Escrow balance is below its funded amount before payment completion.');
  }
  if (job.verdict === 'UNDETERMINED') {
    if (snapshot.settled || snapshot.claimRecorded || snapshot.paid || snapshot.buyerClaim > 0n || snapshot.sellerClaim > 0n) {
      throw new WorkflowIntegrityError('UNDETERMINED unexpectedly has settlement or payment state.');
    }
  } else if (snapshot.claimRecorded || snapshot.settled || snapshot.paid) {
    if (!snapshot.claimRecorded || !snapshot.settled || BigInt(snapshot.outcome) !== BigInt(outcome)) {
      throw new WorkflowIntegrityError('Escrow settlement state does not match the acceptance outcome.');
    }
    if (String(snapshot.settlementDestination).toLowerCase() !== destination.toLowerCase()) {
      throw new WorkflowIntegrityError('Escrow settlement destination does not match the acceptance outcome.');
    }
    if (String(snapshot.receiptCommitment).toLowerCase() !== receipt.toLowerCase()) {
      throw new WorkflowIntegrityError('Escrow recorded a different receipt commitment.');
    }
    const destinationClaim = outcome === 0 ? snapshot.sellerClaim : snapshot.buyerClaim;
    const otherClaim = outcome === 0 ? snapshot.buyerClaim : snapshot.sellerClaim;
    if (otherClaim !== 0n || destinationClaim !== (snapshot.paid ? 0n : amount)) {
      throw new WorkflowIntegrityError('Escrow claimable balance does not match its payment status and destination.');
    }
  } else if (snapshot.buyerClaim !== 0n || snapshot.sellerClaim !== 0n) {
    throw new WorkflowIntegrityError('Escrow exposes claimable funds without a recorded settlement.');
  }
  return snapshot;
}
