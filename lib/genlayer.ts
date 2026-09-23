import { testnetBradbury } from 'genlayer-js/chains';

// The historical studio-dev address is not a current verified deployment.
// Configure this only after deploying and checking the acceptance contract.
export const ACCEPTANCE_CONTRACT =
  (process.env.NEXT_PUBLIC_VERIFIED_ACCEPTANCE_CONTRACT ?? '').trim();
export const ESCROW_FACTORY_CONTRACT =
  (process.env.NEXT_PUBLIC_VERIFIED_ESCROW_FACTORY_CONTRACT ?? '').trim();
export const EVIDENCE_BASE_URL =
  (process.env.NEXT_PUBLIC_VERIFIED_EVIDENCE_BASE_URL ?? '').trim();
export const CHAIN = testnetBradbury;
export const NETWORK_LABEL = `${CHAIN.name} · chain ${CHAIN.id}`;
export const EXPECTED_CHAIN_ID = CHAIN.id;
export const PUBLIC_NETWORK_VERIFIED = false;
export const DEPLOYMENT_IDENTITIES_VERIFIED = false;
export const FEE_QUOTES_CONFIGURED = false;
export const SIGNING_ENABLED = false;
export const GL_EXPLORER = CHAIN.blockExplorers.default.url;

export function missingWritePrerequisites(): string[] {
  const missing: string[] = [];
  if (!ACCEPTANCE_CONTRACT) missing.push('acceptance deployment identity');
  if (!ESCROW_FACTORY_CONTRACT) missing.push('fixed escrow factory identity');
  if (!EVIDENCE_BASE_URL) missing.push('configured immutable evidence repository');
  if (!PUBLIC_NETWORK_VERIFIED) missing.push('verified public network identity');
  if (!DEPLOYMENT_IDENTITIES_VERIFIED) missing.push('independently verified deployment bytecode/source identities');
  if (!FEE_QUOTES_CONFIGURED) missing.push('complete verified transaction fee quotes');
  return missing;
}
