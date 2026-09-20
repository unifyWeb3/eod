# Existing GenLayer and Adjacent Products

Sources retain their individual access dates in `research/SOURCES.md`; inspection depth and unsupported claims are stated explicitly.

| Project | Primary category | Secondary tags | Evidence and relevance | Source / depth |
|---|---|---|---|---|
| Internet Court | Direct competitor | Reference architecture; MCP | Agent agreements, defined evidence, AI jury resolution, Base escrow, LayerZero bridge, API, monitoring UI, and a current top-level MCP implementation. | S9/S25/S56, deep; `README.md`, `PROJECT.md`, `ARCHITECTURE.md`, `contracts/InternetCourt.py`, `mcp/src/index.ts`, `mcp/src/tools.ts`; https://github.com/genlayer-foundation/internetcourt |
| Triage | Adjacent competitor | Bug-bounty vertical | Bug-bounty reports are evaluated by GenLayer consensus and the contract records duplicate, registry, payout, and payout-failure state. | S10, deep; `README.md`, `contracts/security_bounty.py`; https://github.com/mystiquemide/triage |
| Vouch | Adjacent competitor | Payee verification | Payment-path payee substantiation with deterministic screening/corroboration and one bounded fuzzy stage. | S17, deep; `README.md`, `docs/ARCHITECTURE.md`; https://github.com/Ritapossible/Vouch |
| Credent | Adjacent competitor | Reputation | GenLayer reputation oracle and explainable attestation/scoring surface for autonomous agents. | S18, medium; `README.md`, `reputation_core.py`; https://github.com/Ritapossible/Credent |
| Recourse | Adjacent competitor | Inspiration; commitment and SLA resolution | Current source inspection shows bonded commitments, deterministic-first escalation, evidence normalization, semantic outcomes, and agent/vendor SLA workflows. The original S19 access attempt was blocked; the 2026-09-12 deep recheck is S54. | S19 (initial blocked attempt), S54 (deep recheck); https://github.com/Ritapossible/Recourse |
| SealRail | Direct competitor | Proof rail; payment gating; MCP | Current source inspection shows schema/WASM-hash verification, content-addressed inputs/outputs, confirmed Casper anchors, fail-closed payment state, x402 receipts, and reviewer/API/MCP surfaces. It does not show GenLayer subjective adjudication. | S53 (deep), S57 (negative API probe); https://github.com/mystiquemide/sealrail |
| GenLayer Mandate Vault | Adjacent competitor | Policy screening; spending control | Deterministic quantity/policy checks precede one bounded LLM clause-purpose judgment; confidence is canonicalized and prompt injection is fenced. | S55 (deep); https://github.com/Ritapossible/GenLayer-Mandate-Vault |
| argue.fun | Adjacent competitor | Dispute reference | Named by the official portal and Internet Court materials. Current internals and economics are `UNVERIFIED`. | S1/S9, reference only; https://portal.genlayer.foundation/agent-tank/hackathon |
| pm-kit / courtofinternet | Reference architecture | Prediction market | Official portal content describes a prediction-market creation tool using GenLayer. Repository internals are `UNVERIFIED`. | S1, reference only; same portal URL |
| Nomos | Adjacent competitor | Financial primitives; reference architecture | Implements claim verification, proof-of-payable, policy envelopes, encumbrance, and Intelligent Accounts; explicitly separates adjudication from financial consequences. | S35, deep; `README.md`, tree, specifications; https://github.com/etvjay/Nomos |
| Cleara | Reference architecture | Financing and clearing | Proof-native financing/clearing system with evidence manifests and explicit boundaries between proof, authorization, submitted state, and settlement. | S36, deep; `README.md`, tree; https://github.com/etvjay/Cleara |
| Kyvrane | Reference architecture | Deterministic policy | Deterministic pre-execution firewall and hash-sealed receipts. Useful boundary discipline, not a GenLayer competitor. | S11, deep; `README.md`; https://github.com/mystiquemide/kyvrane |
| Olas Mech Marketplace | Adjacent competitor | Potential integration | Onchain agent-service request, delivery, payment, reputation, and multi-chain marketplace flow; inspected materials do not show neutral subjective deliverable acceptance. | S30, deep README/architecture; https://github.com/valory-xyz/autonolas-marketplace |
| Skyfire KYAPay | Potential integration | Payment and identity | Identity-linked JWT payment extension for A2A agents; payment/authentication does not decide subjective work quality. | S26, deep README; https://github.com/skyfire-xyz/kyapay_a2a |
| Nevermined | Potential integration | Agreements; escrow; MCP payments | Plans, agreements, conditions, escrow, credits, and MCP payment gating; an acceptance verdict could become an external condition or adapter input. | S27/S28, deep READMEs; https://github.com/nevermined-io/contracts |
| Logos | Potential integration | Specialist marketplace | Specialist marketplace with x402/EIP-3009 payment, signed responses, attestations, and reputation. | S14, deep; `README.md`, `docs/architecture.md`; https://github.com/Enoch208/Logos |
| Knot | Potential integration | Agent marketplace | Agent marketplace with A2A, ERC-8004 identity, commerce contracts, and compatibility gates. | S13, medium; `README.md`, `COMPATIBILITY.md`, `THREAT_MODEL.md`; https://github.com/Enoch208/knot |
| Kleros | Adjacent competitor | Reference architecture; human arbitration | Human arbitration protocol plus buyer/seller escrow and dispute escalation. It is not GenLayer-based and does not expose the proposed bounded agent-work acceptance primitive in the inspected sources. | S33/S52, medium/deep; https://github.com/kleros/kleros-v2 and https://github.com/kleros/escrow-v2 |
| UMA Optimistic Oracle | Adjacent competitor | Reference architecture; oracle | Optimistic onchain assertions and disputes. Detailed current oracle economics and application fit remain `UNVERIFIED` in this pass. | S29, README; https://github.com/UMAprotocol/protocol |
| ERC-8004 | Potential integration | Enabling primitive; identity and reputation | Agent identity/reputation standard; identity alone does not prove current task completion. | S22, shallow official-standard reference; https://eips.ethereum.org/EIPS/eip-8004 |
| x402 | Potential integration | Enabling primitive; HTTP payments | HTTP payment protocol; payment verification does not establish subjective deliverable acceptance. | S23/S32, shallow/metadata; https://github.com/x402-foundation/x402 |
| A2A / ACP / AP2 / Agent Pay | Potential integration | Enabling primitives; interoperability and commerce | Interoperability and commerce protocols named in official GenLayer docs. Their neutral-adjudication capabilities were not independently inspected, so broader absence claims remain `UNVERIFIED`. | S2/S24/S31, official context plus repository metadata; https://a2a-protocol.org |

## Public-demo inspection status

The inventory records repository and documentation inspection depth, not successful operation of a hosted product. Unless a source row says otherwise, live demo behavior, deployment, and adoption are `UNVERIFIED`; blocked access is recorded as `BLOCKED` and is not used as positive evidence.

| Project set | Public-demo inspection result | Label | Evidence |
|---|---|---|---|
| Internet Court | Source tree, frontend, contract, documentation, and MCP files inspected; no complete hosted end-to-end journey independently operated | `UNVERIFIED` | S9/S25/S56; accessed 2026-09-11 and 2026-09-12 |
| Triage, Vouch, Credent, Recourse, Nomos, Mandate Vault | Source/contract/core artifacts inspected at the recorded depth; no live deployment or public user journey independently exercised | `UNVERIFIED` | S10/S17/S18/S35/S54/S55; accessed 2026-09-11 and 2026-09-12 |
| SealRail | Repository inspected; advertised status endpoint probe returned HTTP 404, which does not establish overall service availability | `UNVERIFIED` | S53/S57; accessed 2026-09-12 |
| Kyvrane, Arca, Knot, Logos, Olas, Skyfire, Nevermined | Repository trees, READMEs, architecture, or metadata inspected; no complete live demo independently captured | `UNVERIFIED` | S11-S14/S26-S30; accessed 2026-09-11 |
| argue.fun, pm-kit / courtofinternet, Kleros, UMA, A2A, x402, ERC-8004 | Portal, standard, repository, or metadata references inspected; no current integrated demo independently exercised | `UNVERIFIED` | S1/S22-S24/S29/S31-S33/S52; accessed 2026-09-11 |

## Explicit non-reproduction rule

Do not reproduce Internet Court's complete general-purpose court, Base escrow contract, LayerZero bridge, three-key dispute lifecycle, or broad human-facing court product as the MVP. The proposed product may integrate with such systems later, but its core must be a narrower acceptance and settlement primitive.
