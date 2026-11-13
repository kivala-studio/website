# W14 intelligence evaluation: web vs iOS

Both platforms run the same 19-scenario library and write the same report shape. The iOS compare script reads both reports.

- iOS: `swift test --filter IntelligenceEvaluationTests` with `INTELLIGENCE_EVALUATION_OUTPUT` set, on Apple Swift 6.4 on macOS 27. The output is `ios-intelligence-evaluation.json`, SHA-256 `a875f195…a6fd13e`.
- Web: `npm run intelligence:evaluate` on Node with Vitest. The output is `web-intelligence-evaluation.json`, SHA-256 `4c340c49…9aef`.
- Compare: `python3 ios/scripts/compare-intelligence-evaluations.py ios-intelligence-evaluation.json web-intelligence-evaluation.json --output diff.md`, which exits 0.

Both reports are deterministic: two iOS runs are byte-identical, and the web suite checks that repeated runs encode the same way.

## Compare output

```
# Intelligence evaluation comparison

No changes to selections, facts, presentations, scores, reasons or expectations.

## After: expectation findings
```

## Per scenario

The compare script checks these fields for each scenario:

- `surfaces`
- `inputs`
- `disabledFeatures`
- `marketState`
- `asOf`
- `facts`
- `presentations`
- `decisions`
- `traces`
- `findings`
- `wrap`
- `events`

The diff is empty for all 19 scenarios:

- new-user
- portfolio-only
- watchlist-only
- engaged-user
- concentrated-portfolio
- diversified-portfolio
- quiet-market-week
- active-market-week
- incomplete-data
- stale-data
- market-holiday
- no-week-ahead-events
- major-relevant-event
- repetitive-information
- already-consumed
- features-disabled
- significance-only
- qualified-notification
- expired-notification

## Not covered by this export

- **Push delivery.** The report covers client qualification and selection only. Server delivery is out of scope on both platforms.
- **Wrap Home cards.** The web `format.period` label only approximates iOS `d MMM` for the wrap Home card eyebrow. No scenario resolves Home to a wrap card, so the export doesn't exercise it.
