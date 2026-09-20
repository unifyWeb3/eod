/**
 * Fee-allocation guards for the Transaction Kit signing path.
 *
 * Background: fee-profile v1 carried raw measured time-unit use
 * (leader 2-5 tu). The kit submits those allocations verbatim and
 * studio-dev consensus reverted a MetaMask-signed create_job with
 * PhaseTimeoutOutOfBounds(2,30,600). Allocation floors below are the
 * onchain-observed network bounds, re-checked at quote time.
 * Nothing here overrides live GEN prices — those are quoted by the SDK.
 */

export const PHASE_TIMEOUT_MIN = 30;
export const PHASE_TIMEOUT_MAX = 600;

export type FeeAllocations = {
  leaderTimeunitsAllocation: string | number | bigint;
  validatorTimeunitsAllocation: string | number | bigint;
};

export function toBig(v: string | number | bigint): bigint {
  return typeof v === 'bigint' ? v : BigInt(v);
}

/** Fail-closed: every allocation that reaches a wallet must be in bounds. */
export function assertPhaseTimeoutsInBounds(a: FeeAllocations): void {
  for (const [name, v] of Object.entries(a)) {
    const n = toBig(v as string | number | bigint);
    if (n < BigInt(PHASE_TIMEOUT_MIN) || n > BigInt(PHASE_TIMEOUT_MAX)) {
      throw new Error(
        `Refusing to sign: ${name}=${n.toString()} outside studio-dev phase-timeout bounds [${PHASE_TIMEOUT_MIN},${PHASE_TIMEOUT_MAX}]. Re-derive the fee profile; never sign below the network floor.`,
      );
    }
  }
}

/** Validate a whole fee-profile file (deploy + every method). Returns problems. */
export function validateFeeProfile(profile: any): string[] {
  const problems: string[] = [];
  const check = (label: string, entry: any) => {
    try {
      assertPhaseTimeoutsInBounds({
        leaderTimeunitsAllocation: entry.leaderTimeunitsAllocation,
        validatorTimeunitsAllocation: entry.validatorTimeunitsAllocation,
      });
    } catch (e: any) {
      problems.push(`${label}: ${e.message}`);
    }
  };
  if (profile?.deploy) check('deploy', profile.deploy);
  for (const [m, e] of Object.entries(profile?.methods ?? {})) check(`methods.${m}`, e);
  if (Number(profile?.chainId) !== 61997)
    problems.push(`profile chainId ${profile?.chainId} != studio-dev 61997`);
  return problems;
}
