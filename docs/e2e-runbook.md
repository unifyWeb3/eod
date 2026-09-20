# Browser E2E runbook (Day-3a) — needs a human with a browser wallet

What I (agent) cannot do: click MetaMask, sign, record video.
Everything below is prepared; the human runs steps 1–7, I verify onchain after.

## Preflight (agent-verified before handoff)
- [ ] App serving: `http://localhost:3101` → 200 (restart: `next start -p 3101`)
- [ ] Acceptance v9 `0xFB388b8213a8Ac809B212E879E62e103F6d7767b` readable on studio-dev
- [ ] `fee-profile.json` chainId 61997 matches `studioDevnet` (quote source: developer)
- [ ] Wallet prepared: MetaMask (or compatible) connected to studio-dev
      RPC `https://studio-dev.genlayer.com/api`, chain ID 61997, funded via
      Studio faucet (💧 button). No secrets ever leave the browser.

## Click path (record screen + note every txid)
1. Open `http://localhost:3101`, scroll to "New job (browser wallet, studio-dev)".
2. Connect wallet → confirm `studio-dev` network (61997) in wallet.
3. Leave the prefilled 2-criterion demo policy (or paste own 2–4 criteria).
4. Review the Transaction Kit quote (fee receipt, preset standard,
   verification must read `verified`; if `mismatch`, re-estimate — do NOT
   use any override). The panel header now shows the exact
   leader/validator timeout allocations being signed with the allowed
   30–600 bounds; if the panel shows a red "Fee profile blocked" error
   instead of the quote, STOP and report it (fail-closed gate working).
   Incident ref: a v1 profile with leader=2 reverted onchain as
   PhaseTimeoutOutOfBounds(2,30,600); fixed in fee-profile v2
   (allocations floored at 30) + `tests/fees-phase-timeout.test.mjs`.
5. Sign `create_job` → wait for `trackUntil=finalized` → copy txid +
   resulting `job-N` (read via inspector or `/api/jobs` entry auto-saved).
6. Submit deliverable + evaluate: current UI covers create only — run
   submit/evaluate via agent scripts against the created jobId (paste jobId
   to agent), OR extend panel first (see UX gaps).
7. Escrow settle: agent-run (operator key) after finalized ACCEPT/REJECT
   receipt; UNDETERMINED settles nothing. Record release/refund txid.

## Record sheet (paste back to agent)
- create_job txid: … / jobId: … / time-to-finalized: …s
- submit txid: … / evaluate txid: … / verdict+receipt: …
- escrow addr + fund txid / settle txid + kind:
- fee quote (deposit / consumed / refund) screenshot or numbers:
- video link/file:

## UX gaps to fix (agent, post-run)
- [ ] Panel covers create_job only → add submit_deliverable + evaluate flows
      (same kit pattern, method + args).
- [ ] Timeline component: poll `getTransaction` → pending→decided→finalized
      with deposit/consumed/refund display (backend already persists txids).
- [ ] Surface `verification: mismatch` as blocking error copy (already
      fail-closed in kit — confirm visually).
- [ ] Show receipt string + explorer links after evaluate finalizes.

## Out of scope for E2E
- No mainnet, no real value (studio-dev GEN + Base Sepolia test ETH only).
- No UNDETERMINED claims (see Day-2 report: unresolved live).
- No relayer changes (operator key; allowlist is doc-only in Day-3a).
