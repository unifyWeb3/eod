# Acceptance Adapter — routine post-delivery verdicts that move money

**One line:** agent buyers post machine-readable acceptance policies, GenLayer validators judge the subjective residue, and a finalized ACCEPT/REJECT receipt releases or refunds escrowed funds — no human review, no private LLM call.

## Problem
Agents hire agents at machine speed. Every job ends with the same question — *did the deliverable meet the terms?* — and today's answers (human review queues, platform support tickets, a private LLM signoff) are slow, inconsistent, and trivially bypassable by the agent being judged.

## What this does
A narrow acceptance rail between agent work and payment:
1. Buyer posts a **versioned policy** (2–4 natural-language criteria).
2. Seller submits a **typed deliverable envelope** (artifacts + hashes + source URIs).
3. Deterministic gates reject malformed work instantly (schema, hash, source) — no LLM spent.
4. Only genuine subjective residue goes to **GenLayer consensus**; validators independently re-judge and must agree exactly.
5. Every job ends in a finalized receipt — `ACCEPT`, `REJECT`, or `UNDETERMINED` — that a downstream escrow acts on: release, refund, or hold.

## End-to-end flow
```
policy → envelope → deterministic gates → GenLayer evaluate → receipt
                                                              ├─ ACCEPT → escrow.release() → seller paid
                                                              ├─ REJECT → escrow.refund()  → buyer refunded
                                                              └─ UNDETERMINED → funds stay locked, no action
```

## Architecture
- **`contracts/acceptance.py`** — GenLayer Intelligent Contract (create_job / submit_deliverable / evaluate / views). Deterministic checks first, one comparative LLM judgment, UNDETERMINED first-class, no custody.
- **`evm/SpikeEscrow.sol`** (Base Sepolia) — buyer-funded escrow; arbiter-only release/refund. Holds the money so GenLayer never has to.
- **`scripts/day2_fixtures.py`** — operator relayer: gates every settlement on `isSuccessful` + FINALIZED + `FINISHED_WITH_RETURN` + exact receipt match. Txids logged to `scripts/day2_state.json`.
- **`app/`** (Next.js + Transaction Kit) — inspector over real onchain history plus a wallet-signed new-job panel quoting from the measured `fee-profile.json` with fail-closed phase-timeout bounds.

## Canonical live proof — job-5 (browser E2E)
A real wallet created the job through the app; consensus judged it; real test ETH moved:

| Step | Evidence |
|---|---|
| browser `create_job` | `0x528bf6c62df8e14c9342aec6611bca6e1e407bb814a6fae1c4fc5de7feae9616` → job-5 |
| `submit_deliverable` | `0x489498a45f342f8d5224594985d75549c17294ce08fde7eaae7f9f3d221dceef` |
| `evaluate` → **ACCEPT** | `0x0a53b7dcbe73f98d7ac58c995852a7a1198dd3c760fa77b57b61580939f308aa` · receipt `job-5:v1:ACCEPT` |
| escrow fund 0.01 ETH | `f15c9c98e0fc5f1de747055a100f0da1e183a12cd85f563ce0c9447b7c4fc67e` → `0xFCb82527807FE191f7d85587057CEE22A29697c2` |
| **RELEASE** | `46dfb9808e7fedb2d6d9f87a9837833759b09f7d8b50e038096de5d5faab6bc2` (status 1) |

Balance proof: escrow 0.01 → **0 ETH** · seller 0.045 → **0.055 ETH** (+0.01 exact) · operator gas accounted separately. Verify: [BaseScan escrow](https://sepolia.basescan.org/address/0xFCb82527807FE191f7d85587057CEE22A29697c2) · [studio-dev explorer](https://explorer-studio-dev.genlayer.com) · full record in `docs/E2E-EVIDENCE.md`.

## Run locally
```bash
python3 -m venv .venv && .venv/bin/pip install \
  "genlayer-py==0.19.0rc2" "genlayer-test==0.30.0rc2" "genvm-linter==0.11.1rc2"
cp .env.example .env   # fill values locally; .env is git-ignored, never commit it
npm install            # next 15.5.25, genlayer-js 2.0.0-rc.1, transaction-kit 0.1.0-rc.2
npm run build && npm start -- -p 3101
```
Needs: studio-dev GEN (faucet) for GenLayer writes; Base Sepolia ETH for escrow flows. No step requires mainnet.

## Deployed contracts / networks (testnets only — no mainnet)
- Acceptance v9 (current): `0xFB388b8213a8Ac809B212E879E62e103F6d7767b` — studio-dev, chain 61997
- Prior builds: v6 `0x96F9…dc5` (Day-2 fixtures), spike contracts (Day-1) — see evidence doc
- Escrows: Base Sepolia, chain 84532 (per-fixture addresses in evidence doc)

## Fee + finality behavior
- Every deploy/write carries SDK-estimated `FeesDistribution` + `feeValue` from the measured `fee-profile.json` (allocations floored at the network phase-timeout minimum 30/30 after a `PhaseTimeoutOutOfBounds(2,30,600)` revert taught us measured use ≠ safe allocation).
- A receipt counts only when the tx is FINALIZED **and** `isSuccessful` (`FINISHED_WITH_RETURN`). The relayer re-reads chain state instead of trusting its own submission.
- Typical: ~5e-5 GEN per method, 35–110s to finalization on studio-dev.

## Limitations (explicit)
- **UNDETERMINED is implemented but untriggered live** — studio-dev validators resolved all 7 ambiguity designs decisively. Never claimed in demos.
- Settlement executes through the **operator key** today; the relayer allowlist is a written design (`docs/relayer-allowlist.md`), not built.
- The browser panel covers job creation; submit/evaluate/settle run via scripts (extension specced in `docs/e2e-runbook.md`).
- Testnets only. Not production, not audited, no mainnet.

## Deeper evidence
- `docs/E2E-EVIDENCE.md` — every verified fund movement with txids, balances, finality
- `docs/e2e-runbook.md` — how to re-run the browser E2E + record sheet
- `docs/relayer-allowlist.md` — settlement trust design
- `data/fixtures.json` — machine-readable fixture history
- Research inputs: `COMPETITION.md`, `EXISTING-PRODUCTS.md`, `FOUNDER-SIGNALS.md`, `GENLAYER-INTELLIGENCE.md`, `OPPORTUNITY-MATRIX.md`
