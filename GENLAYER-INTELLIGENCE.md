# GenLayer Intelligence

## Label policy

`VERIFIED` means the cited official documentation, release metadata, repository artifact, or read-only probe was directly inspected at the recorded date. `UNVERIFIED` marks a current value or behavior that still requires a write, deployment, compatibility, or liveness check. `BLOCKED` is used when an official path could not be inspected. The design implications below are `RECOMMENDATION` statements derived from the verified protocol facts, not claims about current network behavior.

## Current protocol facts

- `VERIFIED` GenLayer is an EVM-compatible ZK Stack chain with a separate GenVM execution environment. Intelligent Contracts split deterministic code from isolated non-deterministic web and LLM operations. Source: official docs S63/S64, https://docs.genlayer.com/understand-genlayer-protocol/what-is-genlayer and https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/genvm, access date 2026-09-11, sections "GenLayer Chain", "GenVM", and "From submission to finality".
- `VERIFIED` A Ghost contract is the EVM-facing entry point at the same address as the Intelligent Contract. Consensus contracts queue work, select an activator, leader, and committee, and record proposals, commits, reveals, decisions, appeals, and finalization onchain. Source: official docs S65, https://docs.genlayer.com/understand-genlayer-protocol/optimistic-democracy-how-genlayer-works, access date 2026-09-11, sections "The three components" and "Transaction lifecycle".
- `VERIFIED` Validators evaluate the leader result using the contract-defined Equivalence Principle. Raw LLM or web output need not be byte-identical; the contract should compare the properties that matter. Source: official docs S6, https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/optimistic-democracy/equivalence-principle, access date 2026-09-11.
- `VERIFIED` Web access is available inside non-deterministic blocks, but sources can change, fail, be personalized, or contain adversarial instructions. Source: official docs S7, https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/web-data-access, access date 2026-09-11.
- `VERIFIED` The transaction lifecycle is proposal, commit, leader reveal, validator reveal, decision, appeal window, and finalization. An EVM receipt alone does not prove the Intelligent Contract execution succeeded. Source: official docs S66/S67, https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/transactions and https://docs.genlayer.com/developers/decentralized-applications/querying-a-transaction, access date 2026-09-11.
- `VERIFIED` The current v0.6 release-family guidance lists GenLayer Studio v0.123 RC, `genlayer-js` v2.0 RC, `genlayer-py` v0.19 RC, and GenLayer CLI v0.40 RC, with matching fee-profile tooling. Source: official docs, https://docs.genlayer.com/developers/consensus-v06-migration, access date 2026-09-11, section "Compatible release lines". These are release-line facts, not an authorization to install prereleases before approval.

## Networks and fees

| Environment | RPC | Chain ID | Status |
|---|---|---:|---|
| Bradbury | `https://rpc-bradbury.genlayer.com` | 4221 | `VERIFIED`, production-like testnet in docs |
| Asimov | `https://rpc-asimov.genlayer.com` | 4221 | `VERIFIED`, infrastructure/stress testnet in docs |
| Studionet | `https://studio.genlayer.com/api` | 61999 | `VERIFIED`, hosted stable development |
| Studio dev | `https://studio-dev.genlayer.com/api` | 61997 | `VERIFIED`, release-candidate preview |
| Localnet | `http://localhost:4000/api` | 61127 | `VERIFIED`, local development |

Source: official docs S3, https://docs.genlayer.com/developers/networks, access date 2026-09-11, network tables.

`VERIFIED` Read-only JSON-RPC `eth_chainId` probes succeeded on 2026-09-11: S48 (`https://rpc-bradbury.genlayer.com`) and S49 (`https://rpc-asimov.genlayer.com`) returned `0x107d` (4221); S50 (`https://studio.genlayer.com/api`) returned `0xf22f` (61999); and S51 (`https://studio-dev.genlayer.com/api`) returned `0xf22d` (61997). These direct probe results verify endpoint responsiveness and chain identity at probe time, not validator health, transaction finality, faucet availability, or write success.

Probe record (read-only, no wallet):

```json
{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}
```

Observed `result` values were `0x107d` for Bradbury and Asimov, `0xf22f` for Studionet, and `0xf22d` for Studio dev (S48-S51). The request shape and results are a network sanity check, not a contract transaction proof.

- `VERIFIED` Fee-charging deployments require an estimated `FeesDistribution` and `feeValue`; unused budget is refunded at finalization. The docs explicitly prohibit hardcoded fee arithmetic. Source: official docs S68/S73/S4, https://docs.genlayer.com/developers/decentralized-applications/fees-and-transaction-kit, https://docs.genlayer.com/developers/decentralized-applications/fee-profiling-and-estimation, and https://docs.genlayer.com/developers/consensus-v06-migration, access date 2026-09-11 for S68/S4 and 2026-09-12 for S73.
- `VERIFIED` Official application guidance separates deployment, read-only calls, and state-changing writes. Source: S70 (`https://docs.genlayer.com/developers/intelligent-contracts/deploying`), S71 (`https://docs.genlayer.com/developers/decentralized-applications/reading-data`), and S72 (`https://docs.genlayer.com/developers/decentralized-applications/writing-data`), official documentation, access date 2026-09-12.
- `VERIFIED` Default v0.6 time-unit fee routing is 85% validator/staking distribution, 10% Intelligent Contract developer, and 5% DeepThought DAO treasury. Source: official docs S5/S69, https://docs.genlayer.com/understand-genlayer-protocol/core-concepts/economic-model, access date 2026-09-11. Governance/configuration may change values.
- `UNVERIFIED` Current live fee prices, caps, and whether a particular hosted environment is gasless for a chosen contract. These require an SDK estimate against the target network.

## Current tooling and repository status

- `VERIFIED` Official GitHub releases currently expose GenLayer CLI `v0.40.0-rc.3`, GenLayer Studio `v0.123.0-rc.6`, GenVM Manager `v0.6.0-rc5`, and GenLayerJS `v2.0.0-rc.1`. Source: official GitHub release APIs, access date 2026-09-11, S38/S39/S40/S41.
- `VERIFIED` npm currently marks CLI `0.39.2` as `latest` and `0.40.0-rc.3` as `rc`; GenLayerJS `1.1.8` is `latest` and `2.0.0-rc.1` is `rc`. Source: npm registry metadata, access date 2026-09-11, S42-S43.
- `VERIFIED` PyPI reports `genlayer-py` stable version `0.18.0` with Python `>=3.12`. The docs' v0.19 RC line was not visible as the PyPI stable release in this check. Source: PyPI JSON API, access date 2026-09-11, S44.
- `VERIFIED` The legacy `genlayerlabs/genvm` repository says it moved to `genlayerlabs/genvm-manager`; the latter describes itself as the WASM VM for Intelligent Contracts. Source: official repository metadata, access date 2026-09-11, S45-S46.
- `VERIFIED` The current boilerplate tree contains a Python Intelligent Contract, direct and integration tests, `gltest.config.yaml`, TypeScript deployment script, fee helper, and Next.js frontend. Source: official repository tree, access date 2026-09-11, S47.
- `UNVERIFIED` A single fully compatible install set has not been installed or executed, because this phase forbids implementation/dependency installation. The docs explicitly require selecting matching RC components rather than mixing `latest` and `rc` tags.

## Documented workflow versus executed research

The table distinguishes the official workflow from this research pass. The documentation's `gltest` direct/Studio test modes and SDK/CLI/Transaction Kit examples are version-sensitive guidance, not command transcripts from this workspace.

| Stage | What the official documentation describes | What this pass actually executed | Status |
|---|---|---|---|
| Test | Direct-mode and Studio-mode Intelligent Contract tests, including mock web/LLM inputs. | No `gltest` run; dependencies and product code were intentionally not installed. | `VERIFIED` documentation; execution `UNVERIFIED` |
| Fee profile | Generate a test-backed fee profile and estimate the required distribution/budget before a fee-charging write. | No fee profile or SDK estimate was generated. | `VERIFIED` documentation; measured values `UNVERIFIED` |
| Deploy | Select a documented network, deploy through the matching toolchain, then query the outcome/finality. | No deployment, wallet setup, or contract write was attempted. | `VERIFIED` documentation; deployment `UNVERIFIED` |
| Read state | Use read-only application queries and distinguish finalized from non-final snapshots. | No contract state was read; only network identity probes were run. | `VERIFIED` documentation; contract read `UNVERIFIED` |
| Write state | Submit a fee-funded state change and follow its consensus, appeal, and finalization lifecycle. | No state-changing transaction was submitted. | `VERIFIED` documentation; write/finality `UNVERIFIED` |
| Network identity | Use JSON-RPC `eth_chainId` as a read-only endpoint sanity check. | Bradbury, Asimov, Studionet, and Studio dev probes returned the documented chain IDs (S48-S51). | `VERIFIED` at probe time |

Sources: S8, S70-S73, and S48-S51; official documentation/probes accessed 2026-09-11 and 2026-09-12. This separation prevents a documented command or workflow from being mistaken for an executed deployment or test result.

## Design implications

1. `RECOMMENDATION`: Use deterministic parsing, schema checks, hashes, timestamps, and source allowlists before invoking a non-deterministic block.
2. `RECOMMENDATION`: Ask the model to interpret evidence, not to own the final settlement rule. Store a structured verdict and bounded rationale.
3. `RECOMMENDATION`: Treat source failure, malformed model output, timeout, and `UNDETERMINED` as first-class outcomes.
4. `RECOMMENDATION`: Track protocol finality separately from the enclosing EVM transaction.
5. `RECOMMENDATION`: Keep the demo on one contract and one workflow. Appeals and multi-chain settlement are stretch work, not MVP requirements.
