# Demo runbook — the job-5 story (no fresh run needed)

Target: 3–5 minutes, one browser tab + explorer links. Everything below
already happened; do not fabricate a new run for the video.

## Story arc (7 beats, ~25s each)
1. **Hook**: "Agents hire agents, but who decides the work was good? This
   receipt does — and it moves money." Show `README.md` canonical table.
2. **Policy**: open the app (`http://localhost:3101`), point at the
   prefilled 2-criterion policy. A buyer wrote this; no code changed after.
3. **Create**: the wallet-signed `create_job`
   `0x528bf6…ae9616` → job-5, FINALIZED. (This signature came from a real
   browser wallet through the Transaction Kit panel.)
4. **Judge**: deliverable submitted
   (`0x489498…21dceef`); GenLayer validators independently re-judged and
   agreed: **ACCEPT**, receipt `job-5:v1:ACCEPT`
   (`0x0a53b7…39f308aa`, first attempt, 58s).
5. **Money**: escrow `0xFCb8…97c2` funded with 0.01 test ETH
   (`f15c9c…c67e`).
6. **Release**: verdict-gated `release()` —
   `46dfb9…b6bc2`, status 1, depth 13. Balances: escrow 0.01→**0**,
   seller +0.01 exact, operator gas separated.
7. **Close**: "Routine acceptance, machine-readable receipt, real funds —
   and the paths it refuses: malformed work dies at deterministic gates,
   bad work gets refunded, ambiguity stays code-complete but unclaimed."

## Click checklist (live or recorded)
- [ ] App home renders fixtures + NewJobPanel
- [ ] BaseScan escrow page: balance 0, release tx visible
- [ ] studio-dev explorer: evaluate tx → ACCEPT + receipt
- [ ] `/api/jobs` shows the 3 job-5 records

## Anticipated questions (answer from evidence, not slides)
- "Was the verdict really decentralized?" → 5 validators, majority-agree,
  independent re-judgment; tx hashes on studio-dev explorer.
- "Where's UNDETERMINED?" → implemented, never triggered live; we show the
  strict-resolution table instead of claiming it. (`docs/E2E-EVIDENCE.md`
  limitations.)
- "Who holds the keys?" → operator key today; allowlist is a written
  design, openly disclosed in README limitations.
- "Mainnet?" → No. Testnets only, unaudited contracts.

## Do NOT do on camera
- No fresh job creation "for the video" (slots/state churn, no benefit).
- No mainnet claims, no UNDETERMINED claims, no APY/fee-revenue claims.
- No pasting keys anywhere (none are needed; wallet signs in-browser).
