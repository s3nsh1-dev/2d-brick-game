# AGENTS.md

Instructions for any coding agent working in this repository. Tool-agnostic and authoritative — if a tool-specific file (`CLAUDE.md`, `.cursorrules`, etc.) contradicts this file, this file wins.

## Project

`arena` — a 2D top-down arena survivor built as a deliberate three-stage architecture exercise. The staging is the point; do not build ahead of the current stage.

| Stage | Scope | Status |
|---|---|---|
| 1 | Playable core: movement, auto-fire, one enemy, waves, XP, HP, game over | **complete** |
| 2 | Feel and content: sprites, audio, particles, game feel, enemy variety, progression, save | **complete** — all five passes. Brief and ledger in `docs/STAGE_2_INSTRUCTIONS.md` |
| 3 | Refinement and ship: polish, flow, deployment. The last stage | **complete** — all six passes plus a gameplay addendum. Brief in `docs/STAGE_3_instructions.md`, history in `docs/version3/` |

**The project is finished. There is no Stage 4.** Stage 1 and 2 completed 2026-08-14; Stage 3
completed 2026-08-15. The current stage is recorded at the top of `ARCHITECTURE.md`.

Work after this point is maintenance, not staging. The one rule that still binds hardest —
do not build ahead of the stage — now reads: do not reopen a stage that closed. If a change
is worth making, make it as a change, not as "Stage 4".

## Stack

- **Phaser 4** (`^4.2.1`) — arcade physics, WebGL renderer
- **TypeScript 5.9**, `strict: true`
- **Vite** — dev server and production build
- **zod** — runtime validation of all JSON game data
- **Vitest** — unit tests for framework-free code
- **ESLint** flat config + `typescript-eslint`

### Phaser 4, not Phaser 3

Phaser 3 ended at 3.90.0. This project targets Phaser 4, which is a major rewrite. Most Phaser code you have memorised is v3 and some of it is now wrong.

- **`import * as Phaser from 'phaser'`.** The default export was removed in v4. `import Phaser from 'phaser'` fails.
- The v3 WebGL pipeline system is gone, replaced by a node-based renderer. Anything referencing `pipeline`, `PipelineManager`, or v3 shader APIs will not compile.
- **`node_modules/phaser/skills/` ships official agent skills for every Phaser subsystem.** Read the relevant skill before touching an unfamiliar subsystem. Prefer it over recall.
- When unsure, check `node_modules/phaser/types/` — the shipped `.d.ts` files are the ground truth.
- Vite full-page-reloads on any source change rather than hot-swapping. This is correct: Phaser's game instance, physics world, and asset cache are in-memory and cannot be patched in place. Do not attempt to add HMR handling.

## Commands

```bash
npm install
npm run dev         # vite dev server
npm run build       # production build, must emit zero warnings
npm run preview     # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings allowed
npm run test        # vitest run
```

## Directory map

Each folder has exactly one job. A file in the wrong folder is a bug even if it compiles.

| Path | Job | Rule |
|---|---|---|
| `src/main.ts` | Instantiate `Phaser.Game`. Nothing else. | Stays under ~15 lines. |
| `src/game.config.ts` | The `GameConfig` object. | Scene registration order lives here. |
| `src/constants/` | Keys, tunables, z-order. | `as const`, no logic, no imports from `src/`. |
| `src/core/` | Portable TypeScript utilities. | **Zero Phaser imports.** Lint-enforced. |
| `src/components/` | Reusable behaviour attached to entities. | Owns state and rules, not rendering. |
| `src/entities/` | Game objects — sprite + composed components. | Extends Phaser sprite classes only. |
| `src/systems/` | Per-frame logic across many entities. | One `update(dt)` each. Never renders. |
| `src/scenes/` | Lifecycle, wiring, scene transitions. | Creates systems, iterates them, tears them down. |
| `src/ui/` | Reusable UI widgets. Added Stage 3. | Panels, labels, buttons, bars. Knows nothing about the run. Not `components/`: that folder is behaviour attached to *entities*, and a widget is neither. |
| `src/platform/` | Browser APIs that are not Phaser's. Added Stage 3. | Currently the `localStorage` adapter and the live settings singleton. It exists because `core/` may name neither `window` nor Phaser, and a helper imported from another scene is a coupling with no name. |
| `src/data/` | JSON content + zod schemas. | Content is data, never a hardcoded array. |
| `src/__tests__/` | Vitest specs. | Covers `core/` and `components/` only. |

## Architectural invariants

Non-negotiable. If a task appears to require breaking one, stop and raise it rather than routing around it.

1. **`src/core/**` never imports Phaser.** It must be usable in a Node test with no DOM. Enforced by `no-restricted-imports`.
2. **Scenes wire, systems think, entities hold state.** A scene's `update()` iterates systems and does nothing else. Business logic in a scene is a design failure.
3. **Cross-cutting communication goes through the typed `EventBus`.** `HUDScene` does not hold a `Player` reference. Reaching for a direct reference between unrelated objects means you need an event.
4. **Composition over inheritance.** `Player` and `Enemy` each own a `Health`; they share no base class of ours. Maximum one level of first-party inheritance anywhere in the repo.
5. **Zero magic numbers outside `constants/balance.ts`.** Speeds, HP, damage, cooldowns, spawn rates, radii, colours. If you type a number into a system or entity, you are in the wrong file.
6. **Everything spawned at runtime is pooled.** Projectiles, enemies, gems, floating text. No `new` inside any `update()` path.
7. **Content is data.** Waves, enemy stats, and weapon stats live in JSON, validated by zod at preload. A malformed data file fails loudly at boot, never silently mid-run.
8. **`dt` is seconds.** Phaser hands you milliseconds; convert once in `GameScene.update()`. Every downstream signature is `update(dt: number)` in seconds.
9. **Scenes clean up.** Every scene registers a `Phaser.Scenes.Events.SHUTDOWN` handler that destroys its systems, clears event listeners, and releases pools. Two consecutive restarts must behave identically to one.
10. **No `any`, no `@ts-ignore`, no non-null assertion outside constructors.** `!` on a field assigned in `create()` is acceptable and idiomatic; anywhere else it needs a comment justifying it.

11. **Presentation is event-driven and one-directional.** No gameplay code calls `sound.play()`, `camera.shake()`, or spawns a particle. Gameplay emits a typed event; `AudioSystem` and `VfxSystem` are the only subscribers that touch presentation APIs. Deleting both must leave the game fully playable, silent and unadorned. (An entity animating *itself* — `Enemy.takeDamage` playing its own hit frame — is entity state, not a presentation service, and stays.)

12. **Emitters and sounds are created once, at system init.** Never per-hit, never per-frame. `VfxSystem` holds a fixed set of pre-configured emitters and re-triggers them at a position with `explode(count, x, y)`. Same for every `Phaser.Sound` instance.

13. **Identical SFX inside a short window are coalesced.** Killing forty enemies in one frame plays one death sound, not forty. The throttle window is `BALANCE.audio.throttleSeconds`. Hit-stop coalesces the same way, with `max` rather than a sum.

14. **Stats are computed, never mutated.** `StatBlock` keeps an immutable base plus a list of modifiers and recomputes on read. An upgrade appends a modifier; removing it restores the exact original value, with no accumulated float drift. Consumers read through `Stats.get` every frame rather than caching — a cached copy is stale the moment a level-up lands.

15. **Save data carries a schema version.** `SaveStore` validates with zod on read; on version mismatch it migrates if it can and discards if it cannot. Corrupt or foreign `localStorage` must never crash the boot sequence. It takes a storage adapter as a constructor argument, so it tests without a browser — `core/` may not name `window` any more than it may name Phaser.

16. **Stage 3 changed no gameplay outcome.** Passes A–F are presentation, options and
    deployment: nothing in them changes where an entity ends up, how much damage anything
    takes, or when a wave starts. `constants/balance.ts` gained presentation keys; its
    existing gameplay numbers were untouched.

    **This invariant has one recorded exception, and it is not a lapse.** After playing the
    Stage 3 build, the project's owner asked for five more waves, a victory condition and a
    health pickup. Those are gameplay. They were built as a separate pass (G) and a separate
    commit, *after* the polish passes, so that the evidence the rest of the stage held is
    still mechanically checkable: `git diff` from the Stage 2 tag shows **no deletions** in
    `waves.json` (five waves appended, ten untouched), no diff at all in `enemies.json` or
    `upgrades.json`, and no changed gameplay value in `balance.ts`. An owner changing scope
    is a decision; an agent quietly widening it is the failure this project exists to teach.

17. **Every colour comes from the palette.** No hex literal outside `BALANCE.palette`. A
    colour typed into a scene, a system or an entity is a bug in the same way a magic number
    is (invariant 5). Two exceptions, both deliberate: `enemies.json` holds the enemy colours
    because type identity is content, and `index.html` repeats the backdrop colour because
    the page has to paint before any JavaScript runs.

18. **UI is composed, not hand-built.** Scenes assemble widgets from `src/ui/`. A scene
    calling `this.add.text()` directly has bypassed the kit, and the next restyle will miss
    it. Positioning and layout stay in the scene; appearance lives in the widget.

19. **Any effect that moves the screen can be turned off.** Screen shake, damage flash,
    hit-stop and heavy particle bursts are all reachable from one reduced-motion setting.
    An accessibility toggle may remove an effect; it may never confer an advantage, and it
    may never remove *information* — damage numbers survive reduced motion, and particle
    counts are damped rather than zeroed.

20. **Optimisation requires a measurement.** No performance change lands without a
    before/after number in its commit message. A reverted optimisation with a recorded
    negative result is a successful outcome and must be written down, not discarded — see
    the three Stage 3 recorded in the performance section below.

## Code style

- Named exports only. No default exports.
- One class per file, filename matches the class.
- `PascalCase` for classes and files that export them, `camelCase` for functions and everything else, `SCREAMING_SNAKE` only inside `as const` constant objects.
- Prefer `readonly` on every field that is not reassigned.
- Prefer `for...of` over `.forEach` in per-frame code — it allocates less and is easier to profile.
- Comment the *why*. Never comment the *what*. A comment explaining what `setVelocity` does gets deleted in review.
- No `console.log` in committed code. Use the debug flag in `balance.ts` if you need runtime output.

## Data and content

Every JSON file under `src/data/` has a matching zod schema in `src/data/schema.ts`. Loading path:

```
PreloadScene → this.load.json() → schema.parse() → typed object into the registry
```

`schema.parse()`, never `safeParse()`, at boot. Bad content should crash immediately and visibly.

## Performance budgets

**The budget is met, and this is the measurement rather than the claim.** Taken in Stage 3
Pass D against a production build (`npm run build && npm run preview`), not the dev server.

| | |
|---|---|
| Method | GL draw calls counted by wrapping the live WebGL context; frame times from `requestAnimationFrame`; heap from `performance.memory`. Phaser 4's WebGL renderer exposes no draw-call counter of its own — only the Canvas one has `drawCount` |
| Conditions | `BALANCE.debug.startWave = 8`, run for **133 s / 7,959 frames**, up to **220 enemies alive** (the pool ceiling) |
| Environment | Chrome 151, WebGL2 via ANGLE on AMD Radeon (radeonsi renoir), 32 texture units, 1280×720 at DPR 1 |
| **Frame time** | mean **16.68 ms**, p50 16.70, p95 16.80, p99 17.00, **max 17.60** |
| **Frame rate** | mean **59.9 fps**; no frame ever doubled — the worst frame missed vsync by 0.9 ms |
| **Draw calls** | **6–10 per frame**, mean 6.4, with 220 sprites on screen |
| **Heap over 133 s** | 79.67 MB → 71.19 MB, i.e. **−8.5 MB**. It shrinks; there is no leak and no steady allocation |

Re-measure by setting `BALANCE.debug.startWave` to 8 and repeating the above. That constant
exists for this and is inert at its default of 1.

### Three optimisations considered and *not* made

Recorded so nobody re-derives them. A negative result is a result.

- **No texture atlas.** Stage 2 deferred this as "a Stage 3 problem". It is not a problem:
  220 sprites cost 6–10 draw calls because the GPU exposes 32 texture units and Phaser 4
  binds the game's ~81 tiny textures across them. There is no batch break to fix.
- **No `BitmapText`.** `Text` re-rasterises its canvas on `setText`, but the heap *fell* over
  133 s and no frame missed vsync. Pass C's per-frame cap on damage numbers already bounds
  the rasterisation to two a frame.
- **No allocation hunt.** Negative heap growth over 7,959 frames is the evidence that the
  existing discipline holds.

### Standing rules

- 60fps with 200 active enemies and 100 active projectiles on mid-range hardware.
- Zero allocations in the hot path — no object literals, array literals, closures, or string concatenation inside `update()`.
- Reuse vector math targets; `src/core/math.ts` exposes scratch vectors for this.
- **Invariant 20: no performance change lands without a before/after number in its commit.**

## Testing

Vitest covers `src/core/` and `src/components/` — the framework-free code, which is exactly why invariant 1 exists. Scenes, systems, and entities are not unit tested; they are verified by running the game.

Every bug fix in `core/` or `components/` ships with a regression test.

## Definition of done

A change is not done until all of these pass:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

...and the game runs with an empty browser console. "It compiles" is not done. "It renders" is not done.

## Never

- Never install a dependency without saying why and waiting for approval.
- Never add a feature belonging to a later stage, even as a stub or a "TODO for later" hook.
- Never widen a type to make an error disappear.
- Never leave a `throw new Error('not implemented')` in a file you reported as complete.
- Never reformat or restructure files unrelated to the task at hand.
- Never write Phaser 3 API calls. Check `node_modules/phaser/skills/` or `types/` first.
