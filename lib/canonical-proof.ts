/**
 * Canonical live proof — job-5 browser E2E.
 * Single source of truth for all proof numbers rendered in JSX.
 * Values verified onchain (see docs/E2E-EVIDENCE.md). Testnets only.
 */

export type CanonicalProof = {
  jobId: string;
  contract: string;
  chain: string;
  chainId: number;
  verdict: "ACCEPT";
  receipt: string;
  rationale: string;
  escrowAmountEth: string;
  escrow: string;
  sellerBeforeEth: string;
  sellerAfterEth: string;
  sellerDeltaEth: string;
  tx: {
    create: string;
    submit: string;
    evaluate: string;
    fund: string;
    release: string;
  };
  explorers: {
    genlayer: string;
    base: string;
  };
};

export const CANONICAL_PROOF: CanonicalProof = {
  jobId: "job-5",
  contract: "0xFB388b8213a8Ac809B212E879E62e103F6d7767b",
  chain: "studio-dev",
  chainId: 61997,
  verdict: "ACCEPT",
  receipt: "job-5:v1:ACCEPT",
  rationale:
    "The deliverable explicitly mentions that the sky is blue and includes the number 42.",
  escrowAmountEth: "0.01",
  escrow: "0xFCb82527807FE191f7d85587057CEE22A29697c2",
  sellerBeforeEth: "0.045",
  sellerAfterEth: "0.055",
  sellerDeltaEth: "+0.010",
  tx: {
    create:
      "0x528bf6c62df8e14c9342aec6611bca6e1e407bb814a6fae1c4fc5de7feae9616",
    submit:
      "0x489498a45f342f8d5224594985d75549c17294ce08fde7eaae7f9f3d221dceef",
    evaluate:
      "0x0a53b7dcbe73f98d7ac58c995852a7a1198dd3c760fa77b57b61580939f308aa",
    fund: "f15c9c98e0fc5f1de747055a100f0da1e183a12cd85f563ce0c9447b7c4fc67e",
    release:
      "46dfb9808e7fedb2d6d9f87a9837833759b09f7d8b50e038096de5d5faab6bc2",
  },
  explorers: {
    genlayer: "https://explorer-studio-dev.genlayer.com",
    base: "https://sepolia.basescan.org",
  },
};

export function shortHash(h: string): string {
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h;
}
