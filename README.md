# Escape — first playable prototype

A browser pirate survival arcade game built with **Phaser 3, TypeScript and Vite**. The supplied coast is the arena, the cannon rotates on the **central fort**, and every ricocheting ball stays in play until Parley or a restart. One hit ends the voyage.

**[Play Escape in your browser](https://charliegghaccount.github.io/escape-game-test/)** — desktop or phone landscape. Updates publish to this same URL.

## Run on your Mac or PC

Install **Node.js 22.12+** (Node 24 LTS recommended), then open a terminal in this folder:

```sh
npm install
npm run dev
```

Open the local address Vite prints. For a reproducible install after the first checkout, use `npm ci` instead of `npm install`.

```sh
npm test          # critical physics, scoring, effects, spawn and difficulty tests
npm run build    # type check + production build in dist/
npm run preview  # serve the production build
```

No backend, accounts, API keys, external fonts or remote game assets are needed.

## Try on your iPhone

1. Connect your computer and iPhone to the **same Wi-Fi**.
2. On the computer, run `npm run dev -- --host 0.0.0.0`.
3. Vite prints a **Network** address such as `http://192.168.1.42:5173`. Open that address in iPhone Safari. It must be your computer's LAN address; `localhost` on the phone points at the phone itself. Allow Node through the computer's firewall if prompted.
4. Turn the phone to **landscape**, tap **Set sail**, select a difficulty, and drag the bottom-left helm.

The cloud workspace's private IP is not your home computer's LAN address. Download this project to your computer for the Wi-Fi steps above. Native iPhone packaging and App Store release are outside this prototype.

## Controls and game loop

- **WASD / arrow keys:** steer in any direction; diagonals normalize.
- **Mouse:** hold the water to sail toward the pointer.
- **Touch:** drag the visible helm; multi-pointer input leaves Pause reachable.
- **P / Escape:** pause/resume. **B:** toggle collision view, also available from Pause.
- Title → difficulty → play → pause/resume → one-hit death/results → retry or menu. Info and separate music/SFX toggles are available from the title; audio settings persist.
- Hidden/background tabs, window focus loss and portrait rotation auto-pause. Return to landscape and resume explicitly.

## Rules, tuning and assumptions

All editable values live in [`src/config.ts`](src/config.ts): `difficultyConfig`, `SCORE`, `effectsConfig`, `EFFECT_VALUES`, and `TUNING`.

| | Easy | Medium | Hard |
|---|---:|---:|---:|
| Initial volley | 1 | 3 | 5 |
| First shot | 0.25s | 0.25s | 0.25s |
| Volley spacing | n/a | 0.4s | 0.4s |
| Opening complete | 0.25s | 1.05s | 1.85s |
| Base ongoing interval | 5s | 4s | 3s |
| Interval reduction / minute | 1s | 1.25s | 1.5s |
| Minimum interval | 1.4s | 1s | 0.65s |
| Relative rotation | 1× | 1.5× | 2× |
| Coin / positive lifetime | 4s | 3s | 2s |
| Negative lifetime | 4s | 5s | 6s |

The opening volley uses a new random heading for every shot, separated by at least 60° in an unobstructed opening. The cannon visibly quick-turns to each heading; Easy fires once, Medium three times, and Hard five times, all within two seconds. It then immediately resumes the mode's normal rotation and schedules its next shot at the normal (gradually accelerating) interval. Unsafe opening headings are redirected rather than postponed so the volley cannot slip past two seconds. Steady shots can still briefly defer for muzzle safety. Every run randomizes the initial angle in every mode. There is **no ball-count cap**.

The time ramp is verified against actual scheduled shots over 130 simulated seconds per mode, not only the formula: at 60 seconds the target intervals are **Easy 4s, Medium 2.75s, Hard 1.5s**, then stop shortening at each configured minimum. Fixed-step execution can round a shot up by at most 1/120 second.

Scoring: **10 points/second + 50/coin + 20/positive − 20/negative**, clamped at zero as points accrue. Coin count is separate. Double score doubles only points earned (including pickup adjustments) while active, never past score. Best score persists locally **per difficulty**. No online leaderboard.

| Token | Effect | Message |
|---|---|---|
| Green ½ | Half ship art and hull | Blimey! |
| Green 2× | Double new points | Booty! |
| Green ⚑ | Remove every ball, instantly | Parley! |
| Green ↑↑ | 1.5× ship speed | Yo-ho-ho! |
| Red XL | 1.35× ship art and hull (+35%) | Landlubber! |
| Red ●↑ | 1.25× ball speed, old and new balls | Shiver Me Timbers! |
| Red ⊘◉ | Remove coins and prevent coin spawns | Plundered! |
| Red ↓ | 0.5× ship speed | Weigh Anchor! |

Timed effects last **10 seconds**, refreshing on repeat rather than stacking. Opposites multiply: small + XL = 0.675× size; fast + slow = 0.75× speed. Ball speed is derived from unchanged base velocities, so expiry cannot accumulate speed errors. Base ship speed is **425 world units/second**, up 25% from 340. Spawn cadence is coins / 1.5s (unchanged), positive / 10s (first at 6s), negative / 12s (first at 8s). Relative positive weights are small 1, double 1, Parley 0.25, fast 1: Parley has about **7.7%** of positive spawns, while each other positive has about 30.8%. This and the slower category cadence make Parley about six times rarer on average. Negative variants remain equally likely. All figures are editable in `TUNING`, `EFFECT_VALUES`, and `pickupWeights`. Expired uncollected tokens disappear. Restart constructs a fresh run with no carried-over effects, timers, coins, balls or messages.

## Physics and artwork

- [`src/physics.ts`](src/physics.ts) contains a normalized, editable trace of the **visible inner waterline**, reconstructed in the artwork's 1920×1080 space. It has over 100 segments, bent corners and bottom-centre headlands. It is not a rectangular collision box.
- Simulation uses **120 Hz fixed steps**. Ball travel is further subdivided to less than half a ball radius. Circle/segment and vertex contacts resolve penetration and reflect against stable inward normals without changing base speed.
- A conservative artwork-bounding circle keeps the ship entirely in water, at half/normal/XL size. The lethal hull is a smaller **heading-aware capsule**, separate from artwork transparency. The central fort blocks the ship. If a future size change makes a fort/shore passage too small, the ship moves to the nearest legal fort-contour position.
- **Intentional rule:** cannonballs fly over the central fort without colliding with it. They spawn beyond its collision radius. This prevents cannon self-collision and keeps shore bounces consistent.
- Debug view: green shore trace, gold fort obstacle, white ship artwork clearance, pink capsule and ball radii.
- The complete 16:9 arena fits the display without cropping or stretching. Wider phone landscapes have deliberate dark ocean side gutters; all four shores and gameplay distances remain intact. UI and helm sit inside the arena and away from notches. Portrait shows a rotation prompt.

| Supplied asset | Runtime use |
|---|---|
| `assets/processed/arena_empty.png` | Arena background; no baked-in ship or fort |
| `pirate_ship.png` | Independent ship; transparent top padding cropped with a Phaser frame |
| `fort_island.png` | Fixed centre island, art origin aligned to fort centre |
| `cannon_barrel.png` | Independent barrel, pivot anchored near its base and rotation aligned to muzzle |
| `assets/reference/…` | Comparison only; annotations never rendered |
| `assets/source/Initial_bg_1.psd` | Original source retained, not loaded at runtime |

Supplied cutouts are **provisional**: ship details and small residual wake marks in the background are not polished or pixel-matched. Missing menus/HUD use temporary parchment/wood CSS; coins and compass tokens are procedural. No stock/reference photos are shipped as production sprites. Sound effects and a short D-minor jig are original Web Audio synthesis placeholders, with distinct fire/death/coin/positive/negative cues and calmer menu/death tempo. Browser gesture rules apply; tap a button to unlock audio.

## Validation

```sh
npm test
npm run build
```

The test suite covers specular reflection, speed conservation, high-speed shore containment over thousands of bounces (all corners and bottom centre), whole-art ship clearance at half/default/XL size, plus double-size stress, oriented hit hulls, scoring/expiry, all eight effects, clear/disable behavior, old/new ball speeds, reset, safe spawn/lifetimes, weighted variant distribution, one-hit death and the difficulty schedule.

The optional browser runner uses Python Playwright and an installed Chromium:

```sh
python3 -m pip install playwright
# Install Chromium for your platform, then set CHROMIUM_PATH if necessary.
# On this cloud machine it is /usr/bin/chromium.
npm run dev
# In a second terminal:
CHROMIUM_PATH=/path/to/chromium npm run test:browser
```

The runner navigates real screens, drives keyboard and actual browser touch events, checks small/wide landscape layouts and portrait auto-pause, replays each difficulty, exercises modifiers and death/retry, and captures images under [`artifacts/`](artifacts/). Its tiny state-driving harness exists **only** on the Vite development server with `?test`; it is excluded from production builds. Production play never has invulnerability or an artificial ball limit.

See `artifacts/browser-report.json` for the last successful browser checks. Chromium phone emulation is useful but is **not physical iPhone Safari validation**; real device/audio feel remains to be playtested. The original briefs and supplied asset guide remain in the repository for comparison.

Next improvements: refine the PSD ship/cannon cutouts; playtest ball speed/spawn cadence on a physical iPhone; replace the synthesized audio and temporary UI with final original assets.

## Playable web link (GitHub Pages deployment)

`.github/workflows/pages.yml` builds, tests, and deploys the game to GitHub Pages after a push to `main`, or a manual workflow run. In repository Settings → Pages, the build source must be **GitHub Actions** and the repository's plan/visibility must support Pages. The successful deployment's `github-pages` environment supplies the actual playable URL. Future pushes to `main` update that same URL.

GitHub Pages is enabled with GitHub Actions as its source. The playable site is https://charliegghaccount.github.io/escape-game-test/. Every push to `main` runs the tests/build and updates the same site. Check the repository’s Actions tab for deployment status; a new version is only considered live after deployment and verification succeed.
