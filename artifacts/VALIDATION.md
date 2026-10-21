# Prototype validation — 21 October 2026

- Node 24.19.0 / npm 11.9.0.
- Clean `npm ci --no-audit --no-fund`: passed.
- `npm test`: **30 / 30 passed**, no skipped tests.
- `npm run build`: TypeScript check and Vite production build passed.
- Chromium browser suite: **50 checks passed**, including two sessions in each difficulty, actual keyboard/touch input, all eight modifier paths, pause/death/retry, audio preferences, and reachable navigation at 1280×720, 844×390, 667×375, 568×320 and 932×430. Portrait auto-pause and landscape return passed. A natural death in a session is a valid death-path outcome; exact complete volley counts/timings are separately verified by model tests.
- Production preview smoke: assets, navigation, keyboard path, live HUD, pause/resume and absence of the development test harness passed.
- No browser runtime errors were observed in either successful final run.
- Collision stress: 18 seeded trajectories × 12,000 steps, with speeds up to 2,250 world units/second after modifiers, plus targeted bottom-centre shots. All stayed inside the radius-offset traced shore, preserving speed. Half/normal/double-size artwork clearance and fort blocking passed.

## Evidence

- `gameplay-desktop.png`, `gameplay-production.png`: playable game captures.
- `gameplay-phone-landscape.png`: touch landscape layout.
- `collision-debug.png`: shore, fort and hull calibration view.
- `gameplay-effects.png`: modifier feedback and status UI.
- `menu-desktop.png`, `results-desktop.png`, `phone-portrait-prompt.png`: navigation screens.
- `browser-report.json`, `production-report.json`: recorded check outcomes.

These are Chromium and Chromium mobile emulation results. Physical iPhone Safari, touch feel and audible music/SFX quality still need human device playtesting. Original cutouts, procedural tokens, temporary menu/HUD artwork and synthesized audio remain provisional. No deployment/publication or Git push was performed.
