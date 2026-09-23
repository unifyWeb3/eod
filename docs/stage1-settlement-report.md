# Stage 1 settlement report

Date: 2026-09-22

## Decision

The smallest supported mechanism is a GenLayer Intelligent Contract external
message scheduled for finalization, delivered to an EVM escrow on the GenLayer
Chain EVM layer. The EVM recipient sees the Intelligent Contract or its ghost
address as `msg.sender`, so it can reject calls from an operator, buyer, seller,
relayer, or forged contract.

The existing Base Sepolia escrow cannot use this mechanism. GenLayer’s external
message is delivered to the GenLayer Chain EVM layer; the official documentation
does not describe delivery to an arbitrary Base Sepolia contract. A receipt hash,
RPC status, operator signature, relayer allowlist, or operator-controlled registry
would therefore be a separate trust bridge and would not satisfy the steward.

This report records the Stage 1 boundary proof. Stage 2 now replaces the old
application acceptance adapter separately; the fixture source below remains a
historical harness and is not evidence for the Stage 2 evaluator.

## Existing findings verified

The requested starting findings are present in the repository:

* `contracts/acceptance.py` stores no buyer or seller, accepts deliverables
  without an authorized-seller check, does not authenticate source bytes or a
  declared digest, and formats receipts as `job-id:vN:VERDICT`.
* `evm/SpikeEscrow.sol` authorizes its public `release()` and `refund()` paths
  by arbiter address without requiring a GenLayer receipt.
* `scripts/day2_fixtures.py` and `scripts/spike_path_b.py` can settle from
  saved local verdict state.
* `docs/relayer-allowlist.md` is a design note and contains no implemented
  finality verification.
* The existing fixtures and deployment settings are historical evidence and
  were not used as proof of this mechanism.

## Proof architecture

`contracts/finality_settlement.py` is a small finality boundary harness. It
stores the job ID, buyer, seller, policy commitment, evidence commitment, and
GenLayer-chain escrow address, plus one fixed fixture outcome for the test
instance. The escrow address may start as zero while the IC address is being
deployed. The deployer can bind the escrow exactly once before settlement;
`publish_outcome()` accepts no outcome argument and emits one typed external
call containing the already-bound result, all of those values, and the
destination. The installed GenLayer runtime’s external interface has no
accepted-stage option; the emitted call is delivered by protocol finalization.
`UNDETERMINED` records no settlement message, and a second outcome is rejected.

The fixed outcome is intentionally a stage-1 harness input. It proves the
settlement boundary and does not claim to be the repository’s semantic evaluator.
Stage 2 must replace it with the existing acceptance evaluation after the buyer,
seller, source, digest, and evidence changes are made.

`evm/FinalityEscrow.sol` is the recipient proof. Its constructor immutably binds
the buyer (`msg.sender`), seller, authorized GenLayer source, source chain ID,
job ID, policy commitment, and evidence commitment. Its only outcome entry
point is `settle`, which also requires and recomputes the canonical receipt
commitment:

* only the bound source address may call it;
* every job, party, policy, evidence, outcome, and destination field must match;
* only ACCEPT or REJECT is accepted;
* ACCEPT records a claim for the bound seller and REJECT records a claim for the bound buyer;
* a second call is rejected; and
* there are no public `release()` or `refund()` paths for a caller to choose.

Settlement records a `claimRecorded` entitlement and emits
`PaymentClaimRecorded`; it does not invoke recipient code. `paid` remains false
until the entitled address successfully calls `withdraw()`, which emits
`PaymentClaimed`. A failed or gas-exhausting withdrawal reverts atomically and
preserves the claim for a later attempt. Recipient behavior therefore cannot
make the finalized external settlement message fail.

## Deployment and commitment sequence

The two contracts cannot be deployed with both addresses in both constructors.
The reproducible setup sequence is:

1. The buyer computes and validates the job, policy, and evidence commitments.
2. The buyer deploys the IC with a zero escrow address and records the returned
   IC/ghost address only after the deployment transaction is finalized and its
   execution result is successful.
3. The same buyer EOA directly deploys and funds `FinalityEscrow`, passing the
   seller, IC/ghost address, job, policy, and evidence commitments. The escrow
   constructor uses `msg.sender` as buyer, so an escrow factory is not used;
   a factory would become the buyer under the current constructor.
4. The IC deployer calls `bind_escrow` once with the escrow address. The method
   rejects other callers, zero addresses, rebinding, and binding after outcome
   publication.
5. A later IC transaction publishes the fixed Stage 1 result and emits the
   finalization-only external message.

The one-time bind is deployment setup and cannot replace the source after the
escrow is funded. There is no operator or arbiter settlement authority. For
this stage, evidence is committed before the escrow is funded because it is an
immutable constructor field in both the IC harness and escrow. Stage 2 chooses
that pre-funding evidence-commitment sequence: the application records the
seller manifest after submission, authenticates it through consensus, and only
then permits the buyer to bind the funded escrow. The semantic evaluator cannot
change the evidence commitment after funding.

## Failure and retry boundary

The protocol has three separate points: the parent IC transaction reaches
finalization; the ghost executes the emitted external message; and the EVM
recipient executes the called function. Official GenLayerJS guidance requires
checking the stored execution result in addition to `FINALIZED`, following
triggered transaction IDs and traces, and preserving the parent transaction ID
across restarts. Its fee APIs expose external gas limits and fee top-ups.

The official sources checked here do not document automatic redelivery of a
failed external EVM call, nor do they make a fee top-up a retry of an already
failed recipient call. This proof makes the external call recipient-independent
by recording the pull claim before any recipient code runs. Withdrawal is an
ordinary EVM call made by the entitled recipient; local EVM atomicity preserves
the claim after a failed attempt, and a later successful call can complete it.
The live protocol behavior of a failed `handleOp()` delivery and any retry
policy remains unverified.

## Protocol and toolchain evidence

Official documentation checked on 2026-09-21/22:

* [Messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages): external messages cross from GenVM to the GenLayer Chain EVM layer, execute through the IC ghost, expose the IC address as `msg.sender`, and can only be emitted at finalization. The same page says Studio EVM contract interaction beyond value transfers to EOAs is not implemented.
* [Finality](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/finality): Accepted is provisional; irreversible settlement must wait for Finalized, and an EVM submission receipt is not the GenLayer outcome.
* [GenLayer Chain integration](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/rollup-integration): Intelligent Contracts run in GenVM, ghosts live on the GenLayer EVM layer, and ghosts deliver finalization messages to EVM recipients.
* [Value transfers](https://docs.genlayer.com/developers/intelligent-contracts/features/value-transfers): transfers to an EOA or EVM contract are external messages and execute on finalization.
* [GenLayerJS source and README](https://github.com/genlayerlabs/genlayer-js): the installed SDK documents emitted messages, triggered child transactions, external-message fee allocations, and the need to check execution success separately from `FINALIZED`.
* [Querying a transaction](https://docs.genlayer.com/developers/decentralized-applications/querying-a-transaction): finalization is separate from execution success; emitted messages, triggered transaction IDs, traces, and transaction IDs must be followed explicitly.
* [GenLayerJS SDK](https://docs.genlayer.com/developers/decentralized-applications/genlayer-js): external message gas limits and fee allocations are explicit, and `topUpFees` is a fee-management operation for an existing parent transaction.
* [Error reference](https://docs.genlayer.com/developers/error-reference): external gas/budget errors and execution failures are defined, but no automatic external-call redelivery guarantee is specified.
* [Transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context) and [upgradability](https://docs.genlayer.com/developers/intelligent-contracts/features/upgradability): deployment caller identity is available, and contracts without configured upgraders retain locked code/upgrader slots.

Installed versions checked:

* Python 3.12.3; `genlayer-py==0.19.0rc2`; `genlayer-test==0.30.0rc2`; `genvm-linter==0.11.1rc2`; `web3==8.0.0`.
* Node.js v22.23.2; installed `genlayer-js==2.0.0-rc.1`; `genlayer==0.40.0-rc.3`; `@genlayer/transaction-kit==0.1.0-rc.2`.
* Foundry `forge 1.7.1`; Solidity compiler 0.8.24.
* The Intelligent Contract pins the repository’s concrete runner hash:
  `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.
* The installed SDK source exposes `@gl.evm.contract_interface`, fixed-width
  `bytes32`, `u8`, and `EmitExternalMessage`. The installed GenVM linter accepts
  the proof contract and extracts its four-method schema.

## Tests and guarantees

The following commands were run in `/home/unify/eod`:

```text
./.venv/bin/python -c 'from genvm_linter.cli import main; import sys; sys.argv=["genvm-lint","check","contracts/finality_settlement.py","--json"]; main()'
PASS: lint and validation; FinalitySettlement; 6 methods; 2 writes; 4 views

./.venv/bin/python -m pytest tests/direct/test_finality_settlement.py -v
PASS: 6 passed

forge build --root evm --offline
PASS: Solidity 0.8.24 compilation

(cd evm && forge fmt --check FinalityEscrow.sol test/FinalityEscrow.t.sol)
PASS: new Solidity proof files formatted

forge test --root evm --offline
PASS: 23 passed, 0 failed

./.venv/bin/python -m pytest tests/direct -v
8 passed, 1 failed: the pre-existing
tests/direct/test_spike_verdict.py::test_evaluate_accept failure.  It still
raises `NondetException: invalid nondeterministic response: text result is
not a string` in the existing `contracts/spike_verdict.py`; this stage did
not modify that contract or test.

node --test tests/*.test.mjs
PASS: 2 passed, 0 failed

npm run build
FAIL: `node_modules/.bin/next` is not executable in this checkout
(`sh: 1: next: Permission denied`).  The same installed Next.js build was
then run directly with `node node_modules/next/dist/bin/next build` and
passed: Next.js 15.5.25 compiled, checked types, generated 6/6 static pages,
and finalized the routes.
```

The six direct tests mock GenVM’s external-message sink. They demonstrate the
source-side calldata encoding, one-time deployer-only escrow binding, bound
ACCEPT and REJECT payloads, buyer/seller destination selection, no message for
the `UNDETERMINED` fixture, and outcome replay rejection. They do not
demonstrate consensus, finality, or rejection of an unfinalized message.

The 23 Foundry tests use `vm.prank(source)` as a mocked protocol delivery
boundary. They demonstrate separate rejection of unauthorized source, wrong
job, buyer, seller, policy, evidence, destination, invalid outcome, and replay;
UNDETERMINED rejection as an escrow input; claim recording without recipient
execution; gas-bomb and reverting recipients; failed withdrawal preservation;
successful recovery through the recipient contract; unauthorized and double
withdrawal rejection; gas-exhausting withdrawal preservation; and reentrancy
protection. The gas-bomb test covers settlement without recipient execution;
the gas-exhausting test separately covers a recipient withdrawal attempt. They
do not prove that a real
GenLayer node produces that `msg.sender`, that a message was finalized rather
than accepted, or that a failed protocol delivery is retried.

No deployment, funds, RPC transaction, or production configuration was used.
No commit was created.

## Remaining blockers

There is no verified Base Sepolia finality bridge in the installed SDK, current
repository, or official mechanism checked here. Studio cannot supply the needed
EVM contract integration, and a live GenLayer-chain deployment was intentionally
not performed because this stage forbids deployment and spending funds.

The source harness fixes its fixture outcome at construction and its public
trigger accepts no outcome argument. This establishes that a caller cannot
choose release or refund at the settlement boundary. It still does not establish
the semantic verdict: Stage 2 must replace the fixture with the acceptance
evaluation and its bounded evidence state. Only the immutable IC/ghost source
can deliver the finalized, fully bound message to this escrow.

The remaining setup assumption is the buyer-controlled deployment ceremony:
the buyer must deploy the IC, directly fund the escrow with the IC address and
evidence commitment, and complete the one-time bind before publishing an
outcome. The source address and escrow bindings cannot be replaced after setup,
and the bind method is not a settlement authority.

The live behavior of a finalized external message whose recipient reverts or
exhausts its external gas budget remains unverified. The local design removes
recipient execution from settlement, but no protocol-level redelivery guarantee
was found. Parent finalization, external delivery success, and recipient
withdrawal completion must be checked separately in Stage 1 protocol
integration.

## Recommended next stage

Keep settlement on GenLayer Chain for the first protocol integration and deploy
the source IC plus `FinalityEscrow` only in an explicitly authorized testnet
ceremony. Verify a real finalized ACCEPT, REJECT, and UNDETERMINED flow, inspect
the parent execution result and external delivery trace, and exercise the
recipient-owned withdrawal after a failed attempt. Treat any retry behavior for
failed external delivery as unverified unless the protocol itself documents and
demonstrates it. Then connect the acceptance contract to the same immutable
receipt bindings and implement the requested seller-only submission and
source/digest/evidence validation.

If funds must remain on Base Sepolia, the next stage must first specify and
verify a canonical cross-chain protocol that authenticates GenLayer finality on
Base. Until that exists, the Base escrow must not be described as trustlessly
settled by GenLayer.
