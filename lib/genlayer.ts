import { studioDevnet } from 'genlayer-js/chains';
import feeProfile from '../fee-profile.json';

export const ACCEPTANCE_CONTRACT =
  '0xFB388b8213a8Ac809B212E879E62e103F6d7767b';
export const CHAIN = studioDevnet;
export const FEE_PROFILE = feeProfile;
export const BASE_EXPLORER = 'https://sepolia.basescan.org';
export const GL_EXPLORER = 'https://explorer-studio-dev.genlayer.com';

export const DEMO_POLICY = JSON.stringify({
  version: 1,
  criteria: [
    {
      id: 'c1',
      text: 'The deliverable must state that the sky is blue.',
      weight: 5,
    },
    { id: 'c2', text: 'The deliverable must include the number 42.', weight: 5 },
  ],
});
