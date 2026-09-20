# E2E Evidence — every verified fund movement

Sources of truth: `scripts/spike_state_b.json`, `scripts/day2_state.json`,
`data/fixtures.json`, `data/jobs.json`. Nothing below is invented: every
txid comes from those files or the directly quoted browser session. Items
that could not be re-queried are marked as such. Networks are testnets
only (GenLayer studio-dev 61997, Base Sepolia 84532). No mainnet anywhere.

Explorers: GenLayer → `https://explorer-studio-dev.genlayer.com/tx/<hash>`;
Base → `https://sepolia.basescan.org/tx/<hash>` (append `/address/<addr>`
for accounts).

Finality rule applied throughout: a receipt counts only when the GenLayer
transaction is FINALIZED **and** `isSuccessful` (`FINISHED_WITH_RETURN`);
the relayer re-reads contract state rather than trusting submission.

---

## CANONICAL — job-5 browser E2E (Acceptance v9)

Contract: `0xFB388b8213a8Ac809B212E879E62e103F6d7767b`
Policy v1: c1 "must state that the sky is blue", c2 "must include the number 42".

| Step | Txid / value |
|---|---|
| browser `create_job` (MetaMask, Transaction Kit, fee-profile v2 quote) | `0x528bf6c62df8e14c9342aec6611bca6e1e407bb814a6fae1c4fc5de7feae9616` → job-5, FINALIZED + FINISHED_WITH_RETURN |
| `submit_deliverable` (pass envelope) | `0x489498a45f342f8d5224594985d75549c17294ce08fde7eaae7f9f3d221dceef`, ok 47s |
| `evaluate` → **ACCEPT** | `0x0a53b7dcbe73f98d7ac58c995852a7a1198dd3c760fa77b57b61580939f308aa`, ok first attempt 58s · receipt `job-5:v1:ACCEPT` · rationale "explicitly mentions that the sky is blue and includes the number 42" |
| escrow fund 0.01 ETH | `f15c9c98e0fc5f1de747055a100f0da1e183a12cd85f563ce0c9447b7c4fc67e` → escrow `0xFCb82527807FE191f7d85587057CEE22A29697c2` |
| **RELEASE** | `46dfb9808e7fedb2d6d9f87a9837833759b09f7d8b50e038096de5d5faab6bc2`, status 1, block 47060805, depth 13 at confirmation, `released=True refunded=False` |

Balances (re-read confirmed): escrow 0.01 → **0.0** ETH · seller
`0x9437…bCd1` 0.045 → **0.055** ETH (+0.010000 exact) · operator
0.10495067 → 0.09494660 (0.01 escrowed + ~4.1e-6 gas, separated).

---

## HISTORICAL VALIDATION

### Day-1 spike (path b) — first real fund move
Source: `scripts/spike_state_b.json`. Minimal verdict contract
`0xdD93A530bDC56b0967114551dc67e1805a473906` (single-criterion spike,
superseded by Acceptance).
- GenLayer deploy `0xca95bf1e92090c80a879c10e043fdec3ae3c2ff0874254e23d78304d5bbb8bd0`, evaluate `0xbdd3d02630ad61cbfdaf9b9ca9d6a27f17fac2af1c614523a2d920eae446bb77` → ACCEPT
- Escrow `0x33731b4ce58BD5B26736C2F95a8f8e9c56e6CE15`, fund `700edc4f01e44e6b1da8babfc9dfac67ad18ce3a2af3d35f2b429fdacdbe9cd4` (status 1)
- RELEASE `17272549a7af355e1f591af1e6b965dffd0d94eaab3d12c9c36776f1f68d7597`
- Counterparty here was the unowned test address `0x1111…1111` (receipt
  proven by onchain balances); owned-seller practice started Day-2.

### Day-2 fixtures (Acceptance v9 `0xFB38…7767b`)
Source: `scripts/day2_state.json` + `data/fixtures.json`.

**pass / job-1 → ACCEPT → RELEASE**
- create `0x4c37245bad1ae591dfc6588a95e6875fb77f5498b692e04cf16d327e8080b94d` (47s) · submit `0x4a9894eb3de333c89eb3fb9e94d1a5ef99fd31ad983614e3ea709cd439d46ce6` (39s) · eval `0xb1f403d3eab2be1b85fb0be572e64c234de760b449b4aa36b08c92d7db63566a` → receipt `job-1:v1:ACCEPT`, rationale "explicitly states that the sky is blue and includes the number 42"
- escrow `0xb090D0Db498019b49199dB2c812E4884B9A66FF4`, fund `f736ee3efea7965cfb189e2d205e2eceed4c9f5f1aa5ca1cc287d61f79c1b61e`, RELEASE `e50d8bd7d70a6eb8498f1f7e9973b72b2173b53da43e62f039e78595b37612b7` (status 1) → owned seller credited.

**structural / job-2 → gate rejection (no LLM, no escrow)**
- create `0x55d41383de7586e43aac0e9f6c2e9d06e2bc54928df1e220505cd5e687e8f04c` · submit `0x2c31f9c1d4ded8159bd07369bc37664acf75fe14fc010dc1e369fccc283a9958` REJECTED by deterministic gate (malformed hash → HASH_MISMATCH by fixture construction; revert reason not exposed onchain, attribution is by construction).

**semantic / job-3 → REJECT → REFUND**
- create `0x4a2332a40e4604351a46717d9707f627ad39073cbfcf036e0652562d64079050` (52s) · submit `0xf5e2d6a34b1890a5052fd8577a9e6c4e51e721c029b80162d9fbdeacf36083c2` (45s) · eval `0xbdba16e3968c21326af9e6594f3c938a79d10a35881e43b2ea7295fd7e99cdd8` (47s, first attempt) → receipt `job-3:v1:REJECT`, rationale "states the sky is green, not blue, but includes the number 42"
- escrow `0xb9BD9563F8470e36FE7846a2631b9c3d6120025E`, fund `cb1420f4d593928c3b14cf29d5f792946b03075f155bb6221c7da5ec759fda14`, REFUND `f81538af18d11c45ce2e884743ed7f602b25b137f82c3a12aff08aff1db39a0b` (status 1), escrow re-read 0.0.

**ambiguous / job-4 (v9) → REJECT → REFUND** (representative of 7 strict-resolution attempts; see Limitations)
- create `0xfe4a8dfe59699851a712980786e42da0d48552037e27cbefd1207a1e73ecba0f` (79s) · submit `0x3572b9a889a4961b21f7e5db64c4c50636cf4852a48d7b7176187a4087e914fe` (71s) · eval `0x2fc18ac8f2776784572594fffbd76e5884535c87c781e31926dba648f9f4d2da` (108s) → receipt `job-4:v1:REJECT`, rationale "mentions the sky only for today, not tomorrow"
- escrow `0x56333fdE7f8Bdc716209BDd29C2B70b5A9dc07Dc`, fund `2827040f475ae71fd104044437621cbf78a8af74d31d2679b81a25811bb730e7`, REFUND `13ada5e68c4074af3549844ee9c211704ea662ebeda07e464136c1c7b0864e49` (status 1), escrow re-read 0.0.

### Superseded builds (provenance, not demo material)
- Acceptance v6 `0x96F9…dc5`, v8 `0x7Cb1…47E1a`: identical code to v9 (TreeMap + parsed-JSON era); early fixtures ran there before the v9 redeploy for fresh slots. Txids for those runs live only in session logs, not state files — **not cited as evidence**.
- Spike escrow/path-a probes, TipJar controls, namespace/probe contracts: engineering probes, no fund claims.

## Fee record (measured, finalized receipts)
- GenLayer deposits: deploy ~1.0e-4 GEN, methods ~5.0e-5 GEN; evaluate consumed exec ~7.9e13 wei, leader 2–4 tu, validators 18–19 tu → profile allocations floored at 30/30 after the `PhaseTimeoutOutOfBounds(2,30,600)` incident (see `fee-profile.json` v2 method note).
- Base gas: escrow deploy ~624k, release ~40k, refund ~35k.
- Time-to-finalized: create 44–79s, submit 39–71s, evaluate 35–260s (LLM variance).

## Limitations carried with this evidence
- UNDETERMINED implemented but never triggered live (7 ambiguity designs resolved decisively with agreement).
- Settlement executed by the operator key; allowlist is design-only.
- Structural gate attribution is by fixture construction (revert reasons not exposed).
- Testnets only; nothing here implies mainnet readiness.
