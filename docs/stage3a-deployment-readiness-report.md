# Stage 3a deployment-readiness report

## Result

Stage 3a prepares the acceptance/escrow path for a live Bradbury ceremony but does **not** make it deployment-ready. Full GenVM contract validation still fails before deployment with `E104: Failed to load contract: 'return'`. No contract was deployed, no funds were spent, no evidence was published, no production configuration changed, and no commit was made.

## Sources and toolchain checked

Official documentation checked: [EVM interoperation](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-evm-contracts), [Networks](https://docs.genlayer.com/developers/networks), [network configuration](https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration), [testing](https://docs.genlayer.com/developers/intelligent-contracts/testing), [Studio limitations](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio/limitations), and the [GenLayer Python SDK repository](https://github.com/genlayerlabs/genlayer-py). The static-hosting decision also checked [Amazon S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

Installed and inspected: Python `3.12.3`; `genvm-linter 0.11.1rc2` at `/home/unify/eod/.venv/lib/python3.12/site-packages`; the contract's exact runner `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`, extracted by the local GenVM manager cache under `genlayerlabs-genvm-manager-v0.6.0-rc5`; Solidity `0.8.24`; Foundry `1.7.1` (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`); `genlayer 0.40.0-rc.3`, `genlayer-js 2.0.0-rc.1`, and `@genlayer/transaction-kit 0.1.0-rc.2`. The linter could not resolve the manager's latest version because network name resolution was unavailable, so every validation command used the already-cached pinned runner; no dependency was updated.

## Runtime compatibility blocker

The accepted source pins `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`; the installed linter is `genvm-linter 0.11.1rc2`. A minimal public contract with one typed EVM `View` method reproduces E104. The identical contract with an empty `View` class validates. The linter's SDK loader sets `GENERATING_DOCS=true`; in the pinned SDK that path tries to unwrap the generated EVM view result annotation, but the generated function has no `return` annotation. This is a reflection/schema-generation defect in the pinned runner's documentation-mode path, not an application error in a particular getter.

`scripts/check_pinned_runner.py` explicitly checks the runner hash, loads the same SDK with ordinary execution-mode imports, and generates the eight-method `Acceptance` schema. It also generates schema for the minimal typed-view reproduction. This is independent evidence that the exact pinned SDK can import and reflect the source outside the linter's documentation-mode setup. It is **not** a GenVM execution or live-network proof: the linter loader supplies WASI mocks. The smallest honest correction is therefore no production code workaround. A supported replacement pin, or a real Bradbury deployment/load result using the same source, is required to clear the blocker.

The official EVM interoperation documentation specifies typed `@gl.evm.contract_interface` views, so removing those real reads or replacing them with mocks would weaken the design rather than resolve compatibility. See [Interacting with EVM contracts](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-evm-contracts).

## Escrow provenance construction

`FinalityEscrowFactory` is a fixed Solidity factory. It has no owner, implementation pointer, registration method, upgrader, discretionary payment path, or arbiter. `deployEscrow` uses `new FinalityEscrow{salt: key}` and stores exactly one address per immutable deployment key. The key is `keccak256(abi.encode(buyer, seller, authorizedSource, sourceChainId, settlementChainId, jobId, policyCommitment, evidenceCommitment, amount))`.

The buyer is `msg.sender` at factory deployment and is passed into the escrow constructor, so factory deployment does not replace the buyer with the factory. The acceptance contract reads `escrowForKey(key)` from the configured factory before it accepts any escrow getters; it then checks all escrow terms and readiness. A real local lookalike contract with matching getters is not the address resolved by the fixed factory, and is rejected. This makes the deployed factory address a fixed deployment trust root. The intelligent contract still has no generic bytecode-proof API, so it cannot independently prove that an arbitrary factory address contains the reviewed bytecode. The ceremony must therefore deploy the reviewed factory, record its address, creation transaction, and code hash, then make that address an immutable acceptance constructor argument.

## Evidence source policy

The accepted source is deliberately one narrow immutable-static grammar:

`https://raw.githubusercontent.com/<lowercase-owner>/<lowercase-repository>/<40-lowercase-hex-git-commit>/evidence/keccak256/<64-lowercase-hex-digest>.txt`

The configured base ends at `/evidence`; the contract derives the full object path from the declared Keccak-256 digest. It rejects queries, fragments, ports, redirects-as-URLs, abbreviated branches/tags, non-commit revisions, arbitrary hosts, and ambiguous encodings. `scripts/build_evidence_envelope.py` makes a strict one-artifact envelope and exact digest from local UTF-8 bytes. This limits the admitted artifact format and source identity. The test base is synthetic and is not a claim that a repository or object exists.

Before a live run, an operator must provide a real public Git repository, commit the static bytes, obtain its full immutable commit hash, and pass the resulting base string at acceptance deployment. GitHub's raw service and the GenVM HTTP API are external systems. The application can authenticate returned bytes and reject wrong/malformed/oversized admitted content, but it cannot observe resolved DNS peers, redirect hops, or all bandwidth/connection work performed before the HTTP API returns. The byte limit bounds content admitted to judgment, not total download resource consumption. The runbook therefore preflights the exact URL with redirects disabled and does not claim this substitutes for runtime network guarantees. Immutable commit paths are chosen over mutable object keys; S3 Object Lock protects object versions but permits later versions at a key. See [Amazon S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html).

## Prepared integration ceremony — do not execute in this stage

Target the GenLayer Bradbury testnet: GenLayer RPC `https://rpc-bradbury.genlayer.com`, chain RPC `https://rpc.testnet-chain.genlayer.com`, settlement chain ID `4221`. The receipt's `sourceChainId` and `settlementChainId` must both be the live `block.chainid`; it is a same-chain architecture, not a Base Sepolia bridge. Bradbury and the faucet are documented at [Networks](https://docs.genlayer.com/developers/networks). Use the exact runner pin above, Solidity `0.8.24`, and a native CLI/toolchain version that can be invoked and recorded. The installed package manifests list `genlayer 0.40.0-rc.3`; the checked-in shell wrapper did not yield a usable `genlayer --version`, so do not use that wrapper for the ceremony until a compatible native CLI version is installed and its version is recorded.

1. Create separate buyer and seller accounts. Fund each with the network faucet only after approval. Record addresses, balances, chain ID, native fee settings, SDK/CLI versions, runner pin, and current factory/escrow code hashes in `docs/stage3a-integration-state.template.json` copied to an untracked run-state file.
2. Build the static artifact locally with `scripts/build_evidence_envelope.py`; commit it to a real public Git repository. Record the full commit, artifact URL, digest, content length, and `Content-Type`. Before deploying, fetch the exact URL with a redirect limit of zero, check status `200`, exact bytes, and content type. This is a host preflight only.
3. Compile and deploy the reviewed `FinalityEscrowFactory` to chain 4221. Record factory address, creation transaction, and `eth_getCode` hash. Deploy `Acceptance(factoryAddress, evidenceBaseUrl)` with the exact pin. Do not bind a different factory after deployment.
4. Buyer creates a job with the policy. Seller alone calls submission with the manifest metadata. Buyer commits the canonical evidence manifest. Buyer calls `factory.deployEscrow{value: amount}` with the exact seller, acceptance address as source, same-chain IDs, job ID, policy commitment, and evidence commitment. Obtain the factory key and deployed escrow address; record its CREATE2 address and funding transaction.
5. Call acceptance binding. Before evaluation, read the factory mapping and every escrow binding, require `readyForSettlement`, verify source and settlement IDs equal `4221`, and read actual funded amount. The evidence commitment must already be committed before funding; this is submission-before-funding and does not pre-fund seller work.
6. Estimate the actual evaluation fee, including any external-message allocation required by the live runtime, then submit evaluation. Save parent transaction ID, timestamp, request body, and returned result. Continue only when the parent is both finalized and reports successful execution/return, not merely a transaction hash. GenLayer describes finality-triggered EVM messaging in [EVM interoperation](https://docs.genlayer.com/developers/intelligent-contracts/features/interacting-with-evm-contracts).
7. For ACCEPT and REJECT separately, retrieve the emitted/returned V3 receipt, recompute the canonical commitment off chain, and compare it to the escrow's settlement event and state. Retrieve the ghost-origin child transaction identifiers/messages; verify sender/origin, destination escrow, decoded calldata, outcome, receipt commitment, destination, and amount. Verify escrow records a claim for the seller (ACCEPT) or buyer (REJECT), then have that real recipient call withdrawal and record the completed payment event and balance delta.
8. For UNDETERMINED, verify a V3 no-payment receipt exists with the defined zero destination, no settlement message/child transaction is emitted, and no escrow claim is recorded.
9. Exercise withdrawal recovery with the `ToggleRecipient` test contract, which can change its own payment behavior and exposes `withdrawFrom()` that it calls itself. Set rejection on, call `recipient.withdrawFrom()` and verify the claim remains; set rejection off, call the same recipient method again, and verify payment completion. The local Solidity test `testRevertingWithdrawalPreservesClaimAndSuccessfulRecovery` demonstrates this recipient-controlled recovery. Keep the gas-exhausting recipient test separate: it demonstrates a withdrawal that consumes gas, while `ToggleRecipient` demonstrates a later successful withdrawal.
10. After every step, persist parent and child identifiers, receipt commitment, contract addresses, calls, statuses, and transaction receipts. On restart, reload this state and query chain state before sending a new transaction. If an external message fails to execute or has no visible child result, stop and preserve evidence. Do not resend an evaluation or assume an automatic protocol retry; this stage has not established a retry guarantee. The GenLayer error reference documents external-execution resource failures but does not provide an automatic-retry guarantee: [Error reference](https://docs.genlayer.com/developers/error-reference).

GenLayer distinguishes direct tests from consensus/network testing; live validation must use a supported environment. Studio cannot currently perform the full EVM contract interaction required here, so the ceremony is intentionally a live Bradbury procedure. See [Testing intelligent contracts](https://docs.genlayer.com/developers/intelligent-contracts/testing) and [Studio limitations](https://docs.genlayer.com/developers/intelligent-contracts/tools/genlayer-studio/limitations).

## Local evidence

The following commands were run after the changes:

```text
./.venv/bin/python -m pytest tests/direct/test_acceptance_stage2.py tests/direct/test_finality_settlement.py tests/runtime -q
58 passed in 29.19s

forge test --root evm --offline
30 passed, 0 failed (Solidity 0.8.24; Foundry 1.7.1)

./.venv/bin/python -m genvm_linter.cli lint contracts/acceptance.py --json
{"ok":true,"passed":3}

./.venv/bin/python -m genvm_linter.cli check contracts/acceptance.py --json
exit 1: E104: Failed to load contract: 'return'

./.venv/bin/python -m genvm_linter.cli check tests/runtime/repros/evm_view_minimal.py --json
exit 1: E104: Failed to load contract: 'return'

./.venv/bin/python -m genvm_linter.cli check tests/runtime/repros/evm_viewless_minimal.py --json
exit 0
```

The local tests demonstrate canonical bindings, factory mapping provenance, rejection of matching-getter lookalikes, strict source-format and byte checks, receipt and payment safety, and callback-level evaluation behavior. Direct tests use controlled EVM/HTTP/model behavior; they do not demonstrate GenLayer consensus, parent finality, ghost-origin delivery, real HTTP/DNS behavior, real LLM prompt-injection resistance, factory deployment provenance on Bradbury, or recipient payment on the network.

## Changed artifacts

- `contracts/acceptance.py`: fixed factory provenance check and commit-addressed evidence source grammar.
- `evm/FinalityEscrow.sol`: factory-preserved buyer constructor argument.
- `evm/FinalityEscrowFactory.sol`: fixed CREATE2 factory with no administrative registration path.
- `evm/test/FinalityEscrow.t.sol`: factory provenance and lookalike regression tests.
- `scripts/check_pinned_runner.py` and `tests/runtime/repros/`: minimal validation diagnosis and ordinary-mode schema check.
- `scripts/build_evidence_envelope.py` and `tests/runtime/test_evidence_envelope.py`: reproducible static envelope builder tests.
- `docs/stage3a-integration-state.template.json`: transaction and binding run-state template.

There is no Stage 3a commit. Existing untracked files were preserved.
