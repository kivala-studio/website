# Paused checkpoint — 18 October 2026

The user requested a stopping point to control time and token usage. Do not continue automatically.

## Saved work

- Website branch: `feat/web-app-parity`, draft PR #10.
- Backend branch: `feat/web-account-return`, PR #73; Apple return receipts are committed and pushed.
- Current website checkpoint adds home/watchlist/portfolio insight sections, verified weekly movement/pattern/allocation/performance facts, attributed publications, exposure receipts and local usefulness preferences.
- Insight selection uses native relationship/significance weights and operational feature controls. Privacy unmounts personal insights. Local preferences expire after 56 days and are removed on confirmed account deletion.
- Recap evidence now requires every expected session, exact closing timestamps and ingestion provenance. Existing archives lacking this evidence will be rejected rather than regenerated; review the migration/user experience before release.

## Checks already completed

- Latest production build and TypeScript passed.
- 21 focused insight, exposure, recap-evidence and archive/storage checks passed.
- Anonymous live reads confirmed the feature-control, catalogue and primary-source publication contracts. Feature configuration v4 parsed successfully.
- Earlier lint run had one hook dependency warning; the dependency was corrected, but lint has not been rerun after the latest changes.
- This insight checkpoint has not been browser-verified or tested with a signed-in account. It is not ready to merge or deploy.

## Resume here

1. Review the latest insight implementation, especially account/privacy changes, partial data, portfolio coverage, feature controls and historical archive handling.
2. Run focused lint, then inspect the rendered insight cards and usefulness controls. Use clearly fictional fixtures or a designated disposable account; do not modify real investment records.
3. Update `docs/web-parity.md` after that review. Its remaining-work list predates this unreviewed insight checkpoint.
4. Continue the original full parity goal: remaining recap story families/ranking, week-ahead and Saturday discovery, Web Push, platform equivalents, and signed-in end-to-end verification. Do not claim full parity from the current checks.

Keep the next session to a bounded feature batch with proportional verification. No production configuration, migrations, secrets or real account deletions were performed.
