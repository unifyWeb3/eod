# Stage 4 application workflow report

The app now presents the acceptance contract’s lifecycle from job creation
through seller submission, evidence commitment, factory funding, escrow
binding, evaluation, parent finalization, escrow claim, and recipient
withdrawal. All writes remain disabled in this build. It does not select an
outcome, release/refund path, or arbiter action.

## Contract sequence and UI behavior

The UI follows the exact contract order:

```text
buyer create_job(policy_json, seller)
  -> authorized seller submit_deliverable(job_id, envelope_json)
  -> buyer commit_evidence(job_id)
  -> buyer calls factory.deployEscrow{value: exact amount}(seller, source, sourceChain, settlementChain, jobId, policyCommitment, evidenceCommitment)
  -> buyer bind_escrow(job_id, escrow)
  -> buyer evaluate(job_id)
  -> parent finalization and execution result
  -> receipt-authenticated escrow claim, if ACCEPT or REJECT
  -> entitled recipient calls withdraw()
```

Evidence is committed before funding because `FinalityEscrow` stores that
commitment immutably. This workflow is submission-before-funding. A seller may
prepare a maximum-four-artifact UTF-8 envelope locally; the builder hashes the
exact file bytes and derives the immutable raw GitHub URL. The app does not
publish files. The buyer’s commit step still depends on the contract’s
validator-side fetch and exact digest check.

The live jobs page reads `get_job_count`, `get_job`, and `get_receipt` from the
configured Acceptance address and checks the current RPC chain ID against the
SDK’s Bradbury chain ID before reads. It retries a job/receipt pair using the
existing bounded consistency rule. A selected job shows the parties,
commitments, evidence envelope and manifest, receipt, lifecycle controls, and
transaction/escrow status.

Only the connected authorized seller sees the local evidence preparation
control for an OPEN job. Buyer controls are lifecycle- and role-gated. The
factory preview fixes the seller, acceptance source, same-chain IDs, job and
commitments, and exact user-entered wei amount; the factory uses the buyer as
`msg.sender`. No default escrow amount or fee estimate is inserted.

ACCEPT targets the seller; REJECT targets the buyer. UNDETERMINED displays a
hold with its no-payment receipt and no settlement or withdrawal action. Parent
finalization, execution result, claim recording, and completed withdrawal are
displayed separately. If the parent is successful but the escrow claim is not
visible, the app says settlement is unobserved; it does not infer failed
delivery or an automatic retry. Evaluation transaction hashes are manually
entered and persisted per job in browser local storage; the app labels their
job association unverified.

## Signing and trust boundaries

Signing is hard-disabled in `lib/genlayer.ts`. This work did not verify or add
Acceptance/factory/evidence deployment values or complete fee quotes. The
Bradbury chain entry in pinned `genlayer-js` is a target configuration, not a
fresh public-network verification. UI configuration and matching getter values
do not prove deployed bytecode identity. The escrow inspector checks the
configured factory’s deployment-key mapping, the live chain ID, escrow balance,
immutable escrow bindings, and the escrow-computed receipt, but cannot authenticate the
configured factory’s own code identity. These reads do not enable writes.

The UI can check a committed envelope against the public job manifest’s IDs,
URLs, digests, media types, and byte counts. It cannot attest the bytes
previously fetched by GenVM from a browser read. No real consensus, validator,
LLM, parent finalization, external EVM delivery, or withdrawal was exercised
for this stage. All client behavior tests use mocks.

The Stage 4 review corrections keep Acceptance previews aligned with their
declared argument types, reject duplicate manifest IDs and incomplete ID
coverage, and capture one EVM block number for the factory mapping, escrow
getters, receipt, claimable balances, and escrow native balance. The workflow
displays that block number. Mock-client assertions cover the shared block
parameter; they do not establish a live RPC or protocol integration result.

The runtime compatibility probe and actual deployment ceremony remain follow-up
work. The [Stage 3a deployment-readiness report](stage3a-deployment-readiness-report.md)
contains the deployment sequence, network/fee preflight, delivery checks, and
failure-recovery runbook.

Neither runtime probing nor the deployment ceremony is marked complete here.
Do not treat this report as completion of either Stage 3 or Stage 4 protocol
integration.

## Validation performed

Commands run in this workspace:

```text
node tests/job-workflow.test.mjs
11 passed, 0 failed

node tests/live-jobs.test.mjs
7 passed, 0 failed

node tests/policy-builder.test.mjs
10 passed, 0 failed

Focused total: 28 passed, 0 failed

node node_modules/typescript/bin/tsc --noEmit
exit 0

node node_modules/next/dist/bin/next build
exit 0; optimized production build completed; /, /app, and /_not-found prerendered

git diff --check
exit 0

node -e "const p=require('./package-lock.json'); if(p.packages[''].dependencies.viem!==p.packages['node_modules/viem'].version) process.exit(1); console.log('lock dependency matches installed viem',p.packages['node_modules/viem'].version)"
lock dependency matches installed viem 2.56.8
```

The first diagnostic build exposed a build-time request to
`fonts.googleapis.com` from `next/font/google`, which failed in this network-
restricted environment. `app/layout.tsx` now uses the existing CSS system-font
fallback, so production builds do not require that remote fetch. The offline
`npm install --package-lock-only --offline --save-exact viem@2.56.8` attempt
could not regenerate the lock because an unrelated optional Tailwind WASM
package was absent from npm’s cache. The already-installed `viem@2.56.8` entry
was present in the lock; its root dependency entry was added and checked
against the package entry.

The policy-builder regression previously parsed a removed `DEMO_POLICY` source
constant. It now checks the current default policy shape directly and covers
the contract’s UTF-8 byte limits.

## Changed files

- `components/JobWorkflowPanel.tsx` — lifecycle controls, local envelope
  preparation, evaluation tracking, escrow reads, and settlement state.
- `components/HistoryView.tsx`, `app/app/AppClient.tsx`,
  `components/app-shell.tsx` — connect job selection, wallet role, and target
  network display to the live workflow.
- `components/NewJobPanel.tsx`, `components/TxTracker.tsx`, `app/layout.tsx` —
  keep creation disabled, correct finality copy, and remove the build-time
  remote Google Fonts dependency.
- `lib/job-workflow.mjs`, `lib/live-jobs.mjs`, `lib/genlayer.ts`,
  `lib/policy.ts` — bounded envelope and receipt checks, role/lifecycle gates,
  escrow state inspection, fresh chain guard, and byte-based policy bounds.
- `tests/job-workflow.test.mjs`, `tests/live-jobs.test.mjs`,
  `tests/policy-builder.test.mjs` — mock-client and validation regressions.
- `.env.example`, `package.json`, `package-lock.json` — blank public workflow
  configuration fields and explicit `viem` pin (`2.56.8`).
- `docs/stage4-application-workflow-report.md` — lifecycle, boundaries, and
  preserved probe/deployment handoff.
