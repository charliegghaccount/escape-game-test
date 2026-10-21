# Escape tuning update — 21 October 2026

## Current checks

- `npm test`: **44/44 passed**, no skipped tests.
- `npm run build`: TypeScript and production bundle passed.
- Chromium desktop and phone regression: **55 checks passed**, no runtime errors. Two sessions per difficulty, real keyboard/touch input, pause/results/retry, eight modifiers, and reachable controls down to 568×320.
- Browser opening observations are recorded in `browser-report.json`: surviving Easy/Medium/Hard openings finish within two seconds; both observed Hard openings reached five shots at about 1.88 seconds.

## Requested changes and regression evidence

1. **Parley rarer:** relative spawn weight 0.25 versus 1 for each other positive, approximately 7.7% of positive drops. Tested via actual scheduled drops and 13,000 weighted selections. With the slower positive cadence, the expected average frequency is about six times lower than the initial prototype.
2. **Ship faster:** 425 rather than 340 world units/second (+25%). Actual displacement, normalized diagonal speed and speed effects tested.
3. **Modifiers less frequent:** positives every 10s, first at 6s; negatives every 12s, first at 8s. Coins remain every 1.5s. Tested actual spawn times through 40 simulated seconds.
4. **XL moderated:** 1.35× artwork and collision hull instead of 2×. Opposite effects combine multiplicatively; expiry restores defaults. Shore tests now cover 0.5×, 1×, 1.35× and a 2× stress case.
5. **Opening quickfire:** shots at 0.25s, then 0.4s gaps as needed: Easy 1 by 0.25s, Medium 3 by 1.05s, Hard 5 by 1.85s. New random headings and fast visible turns between opening shots; exact normal rotation/firing schedule restored afterward. Tests exercise 32 seeds per difficulty, muzzle safety beside the fort and degenerate RNG, plus direction alignment and absence of overlapping schedules.
6. **Escalation verified:** actual emitted steady shot intervals tested for 130 simulated seconds in each difficulty. Target intervals at 60s are Easy 4s, Medium 2.75s, Hard 1.5s; configured minimums hold. Execution quantization is at most one 1/120s step. This was already implemented and has now been checked through the actual scheduler rather than only the interval formula.

## Evidence and limits

Updated gameplay/collision/phone captures and `browser-report.json` are from this local tuning build. `gameplay-production.png` and `production-report.json` retain the original prototype production baseline. Live deployment gets a separate HTTPS/browser check after GitHub Pages succeeds; do not infer publication from these local checks.

Chromium phone emulation is not physical iPhone Safari testing. Artwork cutouts, temporary menus/tokens, and synthesized audio remain provisional. Supplied source art and game logic outside this tuning change were preserved.
