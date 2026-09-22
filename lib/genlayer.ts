import { testnetBradbury } from 'genlayer-js/chains';

// The historical studio-dev address is not a current verified deployment.
// Configure this only after deploying and checking the acceptance contract.
export const ACCEPTANCE_CONTRACT =
  (process.env.NEXT_PUBLIC_VERIFIED_ACCEPTANCE_CONTRACT ?? '').trim();
export const CHAIN = testnetBradbury;
export const NETWORK_LABEL = `${CHAIN.name} · chain ${CHAIN.id}`;
export const SIGNING_ENABLED = false;
export const BASE_EXPLORER = 'https://sepolia.basescan.org';
export const GL_EXPLORER = CHAIN.blockExplorers.default.url;
