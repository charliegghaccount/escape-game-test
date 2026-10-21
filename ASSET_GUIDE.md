# Asset guide — Escape prototype

## Source-of-truth visuals

- `assets/reference/original_gameplay_reference.jpg` — user-provided clean 1920x1080 screenshot. Main visual direction (arena, HUD, centre cannon, player ship).
- `assets/reference/annotated_design_reference.png` — annotated screenshot with coloured circles/red outlines; visual note only. Do not render markup in final game. The annotations are NOT an exhaustive asset/collision specification.
- `assets/source/Initial_bg_1.psd` — original layered 1920x1080 Photoshop composition. Keep as source; layers are reusable but named generically.

## Prepared prototype image assets

All PNGs have alpha where appropriate; generated from the uploaded PSD for fast iteration.

| File | Intended use | Notes |
|---|---|---|
| `assets/processed/arena_empty.png` | Background arena | 1920x1080. Original artwork, objects removed from central ocean. Do not collide with sprite pixels directly. Trace inner shoreline in game coords. |
| `assets/processed/pirate_ship.png` | Player boat | 178x295, transparent; from visible PSD components; resize and rotate around centre. Prototype cutout may need cleanup. |
| `assets/processed/fort_island.png` | Fixed central island | 261x228 transparent fort base; position approximately centred in arena. |
| `assets/processed/cannon_barrel.png` | Spinning cannon sprite | 75x81 transparent; graphic shows barrel angled diagonally. Re-anchor/pivot so angle and projectile muzzle agree. |
| `assets/processed/original_flattened_composite.png` | Read-only visual comparison | 1920x1080; includes stationary ship and cannon. **Do not use as gameplay background with added sprites.** |

Original Photoshop export locations / expected placements in 1920x1080 source-space:

- `fort_island.png`: nominal top-left `(817, 412)`; original artwork geometry is around `(930, 520)`.
- `cannon_barrel.png`: original position about `(891, 463)`; reposition around actual central fort pivot as needed.
- `pirate_ship.png`: nominal top-left `(1259, 603)` (original demonstration placement only). A new game run should spawn it somewhere safe, not always at this exact location.
- `arena_empty.png`: fill background of logical 1920x1080 playing space; adapt to other landscape aspect ratios without misaligning collision geometry.

**Important:** Several visual components were reconstructed from layered PSD via alpha compositing. Their output is useful for prototype but not perfect pixel-for-pixel with Photoshop's full compositing, so inspect rendered result and refine. The PSD includes more detail (shadow/wake/shore layers). Prefer an accurate gameplay result over getting bogged down in a custom PSD extraction pipeline.

## Original briefs folder

Five original Apple Pages documents were converted to readable PDFs, including original concept, V2, V3, V4 and photo references. The definitive compiled instruction, with current cannon-position correction, is `ESCAPE_GAME_DEVELOPMENT_BRIEF.md`. Some screenshots in the original Pages docs are only illustrative.

## Missing assets

The old V3 brief refers to polished menu, results, instruction, ship and coin artwork, plus pirate music files. Those assets were not provided as separate files here. Do not invent their existence. Prototype any missing icons/menus in a coherent pirate style with CSS/canvas/simple generated shapes; use procedural or properly licensed/original effects when possible, and document any provisional graphics/audio.
