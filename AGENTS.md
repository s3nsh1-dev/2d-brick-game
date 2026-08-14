# AGENTS.md

Instructions for any coding agent working in this repository. Tool-agnostic and authoritative — if a tool-specific file (`CLAUDE.md`, `.cursorrules`, etc.) contradicts this file, this file wins.

## Project

`arena` — a 2D top-down arena survivor built as a deliberate three-stage architecture exercise. The staging is the point; do not build ahead of the current stage.

| Stage | Scope | Status |
|---|---|---|
| 1 | Playable core: movement, auto-fire, one enemy, waves, XP, HP, game over | **complete** |
| 2 | Feel and content: sprites, audio, particles, game feel, enemy variety, progression, save | **not started** — brief in `docs/STAGE_2_INSTRUCTIONS.md` |
| 3 | Systems: the simulation stops depending on Phaser — engine-free rules, determinism, replay | not started — brief in `docs/STAGE_3_instructions.md` |

The current stage is recorded at the top of `ARCHITECTURE.md`. Read it before planning any change.

The branch name `feature/stage2` is aspirational, not evidence. As of 2026-08-14 no Stage 2
code exists: `enemyIdSchema` is still `z.literal('grunt')` and `src/` contains no
`AudioSystem`, `VfxSystem`, `StatBlock`, `SaveStore`, atlas or `enemies.json`.

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

Stage 1 targets are deliberately generous; Stage 2 tightens them.

- 60fps with 200 active enemies and 100 active projectiles on mid-range hardware.
- Zero allocations in the hot path — no object literals, array literals, closures, or string concatenation inside `update()`.
- Reuse vector math targets; `src/core/math.ts` exposes scratch vectors for this.

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
