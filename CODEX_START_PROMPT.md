# Paste this entire prompt into Codex after placing this starter pack in the Escape repository

You are the lead gameplay engineer building the FIRST PLAYABLE PROTOTYPE of **Escape**, a bright cartoon pirate survival arcade game. I have added `ESCAPE_GAME_DEVELOPMENT_BRIEF.md`, `ASSET_GUIDE.md`, the original briefs, and original/processed artwork to this repository. Read them, inspect the actual images and available code, and THEN IMPLEMENT the game.

**Critical correction:** The cannon sits on a small fort island in the **CENTRE** of the arena as shown in `assets/reference/original_gameplay_reference.jpg`. An early brief says the cannon is at the edge; that is OBSOLETE. The original gameplay screenshot/PSD and the later 2023 revisions take precedence. The annotated screenshot is for visual context, not markup to show in the game.

**Platform:** Make it playable on my Mac/PC browser immediately using **Phaser 3 + TypeScript + Vite**, and usable in LANDSCAPE on an iPhone via Safari. This is a fast prototype, NOT a native iPhone release yet. Use the existing repo, standard npm scripts, no backend. Avoid unnecessary architecture and feature creep.

**Mandatory end result this run:** Real playable game, not just a concept, static screen, or foundation. Include player-controlled pirate ship, enclosed irregular shore collision, centrally rotating/firing cannon, persistent ricocheting cannonballs, 1-hit death, 3 difficulties, time + coin scoring, 4 positive and 4 negative pickups and expiry, coin spawns, pause, restart/results, touch + keyboard input, and visible pirate-themed UI approximating the supplied art. Keep separate, configurable score/effects/difficulty constants. Fix historic bugs from Version 4 by construction.

**Assets:** Use the supplied PSD/processed art; `assets/processed/arena_empty.png` is the playable background with ship and island removed. Overlay separate sprites (`pirate_ship.png`, `fort_island.png`, `cannon_barrel.png`) at appropriate positions. The processed assets are provisional; adjust cropping, visual origin, scale and masks to closely reproduce the reference. Do not bake a second ship/cannon in the background. Do NOT use unrelated stock/reference images as production sprites without rights. Do not waste time generating replacement landscape artwork that doesn't resemble the screenshots.

**Physics priority:** DO NOT cheat by bouncing off an invisible standard rectangle while displaying an irregular shore. Fit collision segments to the visible inner water boundary; use ship inset and ball-radius offsets, stable bounce normals, penetration resolution / collision substeps, test the bottom-centre and corner cases. Ball escape, ship clipping behind terrain, or unreachable controls means the prototype is not complete. Provide an optional debug overlay for collisions.

**Execution:**
1. Inspect all inputs/repo and make a short implementation plan, then proceed without waiting for approval.
2. Create the project/gameplay and complete the full vertical slice, prioritizing the core physics and controls over detailed menu/audio polish.
3. Validate desktop and responsive phone-landscape layouts, actual navigation, every difficulty and modifier, and collision reliability. Add automated tests for critical logic, run `npm run build`, fix build/runtime issues, and capture at least one gameplay screenshot using a browser tool if available.
4. Finish with exact commands to run locally and try on my iPhone (on same Wi-Fi if applicable), concise what-works/known-gaps summary and local commit if appropriate. Don't push or publish.

**Don't ask me routine technical questions.** Choose reasonable configurable prototype values wherever the source didn't specify them and list these assumptions. Do not claim you have fully matched original art or polished assets unless you actually have. Follow `ESCAPE_GAME_DEVELOPMENT_BRIEF.md` as the authoritative detailed acceptance criteria.
