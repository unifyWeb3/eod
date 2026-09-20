# Relayer Allowlist — design (Day-3a, not built)

Status: DESIGN ONLY. Runtime keeps the single operator-arbiter key.
No code changes in this pass unless trivial.

## Problem
Today any holder of the operator key can call `release()`/`refund()` on any
`SpikeEscrow`, for any reason, at any time. The GenLayer gating
(isSuccessful + FINALIZED + FINISHED_WITH_RETURN + receipt match) lives
entirely in off-chain operator discipline (`scripts/day2_fixtures.py`).
A compromised or buggy operator can move funds against verdicts.

## Goal
Make unauthorized settlement impossible onchain, while keeping the
GenLayer-verdict → EVM-settlement bridge simple and auditable.

## Design

### 1. Arbiter set (onchain, Base Sepolia escrow)
- Replace single `arbiter: address` with `arbiters: mapping(address => bool)`
  plus `setArbiter(addr, allowed)` callable only by `owner` (deployer).
- `release()`/`refund()` require `arbiters[msg.sender]`.
- Rotation: owner revokes a compromised relayer without redeploying the
  escrow or touching locked funds.
- Day-3a scope: 1-of-N (any allowlisted relayer may settle). M-of-N
  multisig is a later step; single-key compromise is already reduced to
  allowlisted-relayer compromise.

### 2. Per-job binding escrow ↔ jobId (offchain registry + onchain memo)
- Escrow constructor takes an extra `bytes32 jobRef` =
  `keccak256(acceptanceContract || jobId || policyVersion)`.
- Relayer config maps `jobRef -> { acceptance, jobId, escrow, expected }`.
- Before signing `release`/`refund`, the relayer MUST:
  1. `get_job(jobId)` on the recorded acceptance contract (not any address),
  2. require `status` FINALIZED-terminal and `isSuccessful(tx)` on the
     evaluate tx AND `FINISHED_WITH_RETURN`,
  3. require `receipt == jobId:v<policyVersion>:<VERDICT>`,
  4. require `VERDICT` maps to the called action (ACCEPT→release,
     REJECT→refund; UNDETERMINED→no action, ever).
- Any mismatch aborts loudly (alert, no retry, no fallback path).
- Emits `Settled(jobRef, verdict, txHash)` from the relayer log
  (append-only JSONL next to txid logs) for audit.

### 3. Event log (offchain, committed)
- Extend `scripts/day2_state.json` shape per fixture with:
  `eval_state:{status,receipt,rationale,isSuccessful,finalized}`,
  `settle:{kind,tx,block,checks:[...]}`.
- The `/api/jobs` store already persists `{txid, policy, jobId, at}`;
  add `verdict`, `receipt`, `settleTx` fields (backward compatible).

### 4. What stays manual in Day-3a
- Owner key == operator key (no separate cold owner yet).
- No onchain verdict verification (ZK/attestation bridge is out of scope;
  the binding is relayer-enforced + publicly auditable via explorer links).
- No timelocks, no M-of-N, no revocation UI (wired in frontend later).

### Acceptance criteria for the build pass (later)
- `setArbiter` + revocation covered by Base Sepolia txs on a throwaway escrow.
- Relayer refuses: wrong contract address, non-finalized verdict,
  receipt mismatch, UNDETERMINED settle attempt (each demonstrated once
  against fixtures, logged).
- No change to consensus path; fee profile untouched.

## Decentralization path (noted, not built)
1. Allowlist (this doc) → 2. M-of-N relayer set with onchain threshold →
3. Optimistic settle with challenge window (anyone can dispute a settle
   against the finalized receipt within N blocks; disputes slash relayer
   bond) → 4. Direct onchain receipt verification when GenLayer exposes
   a cheap EVM-verifiable finality proof.
