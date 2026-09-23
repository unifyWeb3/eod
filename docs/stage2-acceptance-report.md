# Stage 2b acceptance and settlement report

Date: 2026-09-22

## Scope and result

Stage 2b updates the Stage 2 acceptance/settlement proof only. It does not
deploy, fund, push, change production configuration, or modify the frontend.
The Stage 1 `FinalitySettlement` contract remains an isolated fixed-outcome
fixture. It is not the application evaluator and is not evidence of live
protocol delivery.

The result is a locally tested V3 receipt and a narrower evidence format. It
does **not** close two integration blockers: the pinned IC runtime has no
established way for the IC to attest EVM escrow bytecode, and local tests do
not demonstrate GenVM consensus or external-message execution.

The lifecycle is unchanged in its ordering:

```text
buyer create_job
  -> authorized seller submit_deliverable
  -> buyer commit_evidence
  -> buyer funds and deploys FinalityEscrow with the committed evidence
  -> buyer bind_escrow
  -> buyer evaluate
  -> finalized external message (ACCEPT/REJECT only)
  -> entitled party withdraws recorded claim
```

Evidence is committed before funding because the escrow constructor stores its
evidence commitment immutably. This authenticates a submission-before-funding
flow; it must not be described as prefunding the seller's work.

## Receipt and settlement interface

`FinalityEscrow` now uses `EOD-RECEIPT-V3`. The identical Python and Solidity
commitment is:

```text
keccak256(abi.encodePacked(
  bytes32("EOD-RECEIPT-V3"),
  uint256 sourceChainId,
  uint256 settlementChainId,
  address sourceContract,
  address escrow,
  bytes32 jobId,
  address buyer,
  address seller,
  bytes32 policyCommitment,
  bytes32 evidenceCommitment,
  uint8 outcome,
  address destination,
  bytes32("NATIVE_GEN"),
  uint256 fundedAmount
))
```

All integers are 32-byte big-endian values, addresses are 20 bytes, `outcome`
is one byte, and the two labels are right-zero-padded `bytes32` values. The job
field is `keccak256("EOD-JOB-V2:" || UTF-8(jobId))`. Policy and evidence
commitments are Keccak-256 of canonical UTF-8 JSON using sorted keys and
compact separators. The shared vectors are
`evm/test/receipt-vectors.json`; both the Python direct tests and Foundry test
read the same file.

The EVM constructor now accepts both source and settlement chain IDs, requires
each to equal `block.chainid`, and records them immutably. The Python contract
uses `gl.message.chain_id` for both fields. `settle` still receives the source
chain field from the finalized message and verifies it; the receiver recomputes
the commitment using its immutable settlement chain ID and checks that it is
currently on that chain. This is deliberately a same-chain architecture.

`evaluate` has no caller-supplied outcome or destination. ACCEPT uses the
seller destination and REJECT uses the buyer destination. UNDETERMINED creates
and stores a V3 receipt with outcome `2` and the defined no-payment destination
`address(0)`, but emits no settlement message. `FinalityEscrow.settle` rejects
UNDETERMINED even when supplied with that exact receipt, so no claim is
recorded.

The escrow retains pull payments. Settlement records a claim without invoking
recipient code. A completed payment occurs only when the entitled address
successfully calls `withdraw()`. The existing Foundry regressions cover a
gas-bomb settlement recipient separately from a gas-exhausting withdrawal;
the latter preserves the claim and funds after a failed recipient withdrawal.

## Evidence policy and runtime boundary

The supported artifact envelope remains UTF-8 JSON with exactly `artifacts`.
Each artifact has exactly `id`, `source`, `digest`, and `media_type`. It only
supports `text/plain; charset=utf-8` and a lower-case
`keccak256:<64 hex characters>` digest.

The source grammar is now intentionally exact, rather than a general URL
filter:

```text
https://evidence.eod.example/keccak256/<digest hex>.txt
```

`<digest hex>` must equal the hex portion of the declared digest. Every other
form is rejected, including IP literals, private and link-local addresses,
ports, credentials, query strings, fragments, percent encodings, and traversal
forms such as `/%2e%2e/private`. `evidence.eod.example` is a deliberately
compile-time, placeholder origin for this bounded proof; no live source origin
was configured or deployed in this stage. A real deployment needs a controlled
immutable/static origin and a new reviewed deployment rather than widening this
contract's source policy.

The limits are four artifacts, 4,096 response-body bytes each, 12,000 total
body bytes admitted to the manifest and prompt, 512 UTF-8 bytes for a URL, 64
UTF-8 bytes for an artifact ID, and 6,000 UTF-8 bytes each for policy and
envelope JSON. Artifact IDs are now measured in encoded bytes, with a test at
the 64/68-byte UTF-8 boundary. The implementation rejects oversized content;
it never truncates it.

The 4,096/12,000 limits bound content admitted to judgment. They do **not**
bound download resource consumption: the installed pinned `gl.nondet.web.get`
API accepts only URL, optional headers, and `sign`; it returns an already
materialized `status`, `headers`, and `body`. It exposes no request byte limit,
streaming interface, resolved peer address, final URL, or redirect chain. The
contract rejects a visible non-200 response, including a visible 3xx, but
cannot observe a redirect followed inside the web runtime or DNS rebinding.
The digest check authenticates returned content bytes; it does not establish a
network-layer SSRF or resource-use guarantee. Those need a live runtime
configuration/integration assessment.

## Escrow binding and authenticity boundary

Before binding and again before evaluation, the IC asks the typed EVM interface
for buyer, seller, authorized source, source chain, settlement chain, job,
policy, evidence, funded amount, and `readyForSettlement()`. In the reviewed
Solidity implementation, readiness means it has not settled or paid, has no
receipt or claim recorded, and still has at least the immutable constructor
funded amount. The constructor itself rejects zero funding.

This proves the state checks only **if the address is already known to contain
the reviewed `FinalityEscrow` implementation**. It does not prove that premise.
The pinned `@gl.evm.contract_interface` API provides typed calls and an account
balance property, but no documented/available code-hash, bytecode retrieval,
storage proof, or transaction inclusion proof callable by an IC. The direct
test intentionally supplies a lookalike that returns every expected getter and
readiness value while having no enforcement; binding succeeds. That is a
demonstration of the limitation, not an authentication claim.

No mutable registry, arbiter, signature, RPC assertion, or operator fallback
was introduced. A feasible next protocol capability would be a chain-verifiable
code/implementation attestation available to the IC, or a protocol-supported
deterministic deployment/proof mechanism that lets the IC verify the actual
escrow bytecode and state. Until then, a buyer's address selection is an
unverified deployment ceremony, not cryptographic escrow authentication.

## Validator and adversarial coverage

Both nondeterministic operations use `gl.vm.run_nondet`. The evaluation
validator re-fetches the sources, re-authenticates their bytes, compares its
manifest to the leader manifest, independently invokes the model, normalizes
both outputs, and requires identical criterion verdicts. The parser requires
exactly `results` and `rationale`, unique full criterion coverage, a
280-UTF-8-byte rationale bound, and only `PASS`, `FAIL`, or `UNCLEAR`.

Direct-mode tests now invoke the captured production validator callbacks with
the direct harness's `run_validator()` facility. They show agreement under
controlled matching data and rejection for changed fetched bytes, changed
leader digest/source/byte-count manifest fields, malformed leader data, and
different criterion verdicts. A captured prompt test verifies that delimiter-
like artifact text is JSON-escaped inside the authenticated-data block and
that the prompt says artifact instructions are data. The live-handler mock also
checks malformed model output fails closed.

These are local callback tests using controlled web and model responses. They
are not GenVM validator consensus, real web behavior, or real LLM
prompt-injection resistance evidence.

## Verification

Commands run in this checkout:

```text
./.venv/bin/python -m pytest tests/direct/test_acceptance_stage2.py tests/direct/test_finality_settlement.py -q
46 passed in 25.23s
  - 40 acceptance tests, including actual captured local callbacks
  - 6 Stage 1 fixture tests

forge test --root evm --offline
27 passed, 0 failed

forge fmt --root /home/unify/eod/evm --check \
  /home/unify/eod/evm/FinalityEscrow.sol \
  /home/unify/eod/evm/test/FinalityEscrow.t.sol
passed

./.venv/bin/python -m genvm_linter.cli lint contracts/acceptance.py --json
{"ok":true,"passed":3}

./.venv/bin/python -m genvm_linter.cli check contracts/acceptance.py --json
{"ok":false,"lint":{"ok":true,"passed":3},"validate":{"ok":false,"errors":[{"code":"E104","msg":"Failed to load contract: 'return'"}]}}

./.venv/bin/python -m genvm_linter.cli check contracts/finality_settlement.py --json
{"ok":true,"lint":{"ok":true,"passed":3},"validate":{"ok":true,"contract":"FinalitySettlement","methods":6,"view_methods":4,"write_methods":2,"ctor_params":8}}
```

Both semantic-check invocations first reported that the linter could not
resolve the latest GenVM version because network DNS was unavailable, then
used their already-installed local cache. No version was downloaded or changed.

The acceptance linter's AST pass succeeds, but semantic runtime validation
fails while loading the normal typed EVM view declarations with `E104` and
`'return'`. Stage 2b removes the prior `os`/`GENERATING_DOCS` guard rather than
masking this failure. The direct harness does exercise the declarations through
mocked `ExternalCall` responses, but that is not full runtime verification.

The Foundry source caller is `vm.prank(source)`, and the EVM getters/messages
in direct tests are hooks. These prove Solidity enforcement and local Python
logic, not authenticated IC ghost origin, consensus finality, code identity,
or external-message delivery.

## Sources and installed versions

Official sources checked on 2026-09-22:

* [Messages](https://docs.genlayer.com/developers/intelligent-contracts/features/messages)
  — external messages execute at finalization through the IC ghost, whose
  address is the recipient's `msg.sender`.
* [Interacting with EVM contracts](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-evm-contracts)
  — typed views, messages, and EVM balance access.
* [Web access](https://docs.genlayer.com/developers/intelligent-contracts/features/web-access)
  and [web-data access](https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/web-data-access)
  — independent validator fetches, changing/adversarial web data, and defined
  evidence failures.
* [Non-determinism](https://docs.genlayer.com/developers/intelligent-contracts/features/non-determinism)
  — validator/leader execution and deterministic message-emission boundary.
* [Transaction context](https://docs.genlayer.com/developers/intelligent-contracts/features/transaction-context)
  — sender, contract address, and chain ID.
* [Studio limitations](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio/limitations)
  — EVM contract interaction needs live-network validation.
* [GenVM configuration](https://docs.genlayer.com/validators/genvm-configuration)
  — the web module owns URL checks; runtime configuration is a separate
  validator concern.

Installed versions checked: Python 3.12.3; `genlayer-py==0.19.0rc2`;
`genlayer-test==0.30.0rc2`; `genvm-linter==0.11.1rc2`; `web3==8.0.0`; Node.js
v22.23.2; `genlayer-js==2.0.0-rc.1`; `genlayer==0.40.0-rc.3`;
`@genlayer/transaction-kit==0.1.0-rc.2`; Foundry 1.7.1; Solidity 0.8.24. The
contract pins
`py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`.

## Files and remaining work

Changed Stage 2b files:

* `contracts/acceptance.py`
* `contracts/finality_settlement.py`
* `evm/FinalityEscrow.sol`
* `evm/foundry.toml`
* `evm/test/FinalityEscrow.t.sol`
* `evm/test/receipt-vectors.json`
* `tests/direct/test_acceptance_stage2.py`
* `tests/direct/test_finality_settlement.py`
* `docs/stage2-acceptance-report.md`

No commit was created. Existing untracked work was preserved.

The next authorized stage should first resolve the two blockers with a real
GenLayer Chain integration: (1) a supported way for the IC to authenticate
the reviewed escrow code and state rather than trusting getters, and (2) an
integration transaction demonstrating a successful finalized parent,
successful triggered EVM message, recipient `msg.sender`, settlement claim,
and withdrawal. It must also establish the real web runtime's redirect, DNS,
and response-size behavior. The protocol sources checked do not establish an
automatic retry after failed external-message execution; no retry guarantee or
operator-controlled fallback is claimed here.
