# Kickstart prompt — Stage 1 (historical)

> **This document is a record, not an instruction.** It is the prompt that scaffolded Stage 1,
> kept so the original ask can be compared against what shipped. **Stage 1 is complete** — do
> not paste this into a session and do not scaffold against it.
>
> Where it disagrees with the repo, the repo is right. Known divergences: `src/__tests__/`
> holds five spec files rather than the two listed below, and `Controls.ts` is untested
> because it imports Phaser.
>
> For current work start at [`STATUS.md`](STATUS.md), then the brief for the current stage —
> [`STAGE_2_INSTRUCTIONS.md`](STAGE_2_INSTRUCTIONS.md).

---

You are scaffolding **Stage 1** of a 2D top-down arena survivor game (Vampire Survivors-lite). I am a professional TypeScript developer — skip beginner explanation, skip tutorial framing, write production code.

## Stack — pin these, do not substitute

| Package | Version | Note |
|---|---|---|
| `phaser` | `^4.2.1` | Phaser 4, **not** 3.x |
| `typescript` | `^5.9` | `strict: true` |
| `vite` | latest stable | dev server + build |
| `zod` | latest stable | runtime validation of JSON game data |
| `vitest` | latest stable | unit tests for `src/core` and `src/components` |
| `eslint` + `typescript-eslint` | latest stable | flat config |

Before writing any Phaser code, read `node_modules/phaser/skills/` — the package ships agent skills documenting every subsystem. Use them. Do not write Phaser 3 patterns from memory.

**Phaser 4 breaking changes you must respect:**
- `import * as Phaser from 'phaser'` — the default import was removed in v4.
- The v3 WebGL pipeline is gone; anything referencing `pipeline`, `PipelineManager`, or v3 shader APIs is dead.
- Verify every API against the shipped types or `skills/` before using it.

## Game

Top-down arena. Player moves with WASD, auto-fires at the nearest enemy. Enemies spawn in waves from off-screen and chase the player. Killing enemies drops XP gems. Player has HP. Run ends on death.

## Stage 1 scope — and only this

**In:** player movement, auto-aim weapon firing pooled projectiles, one enemy type with chase AI, wave-based spawning driven by JSON, collision damage both ways, XP gems, HP bar and wave counter in a parallel HUD scene, game over with restart.

**Out — do not build, do not stub, do not "prepare for":** sprites or art beyond coloured rectangles, audio, particles, screen shake, upgrade/level-up system, multiple enemy types, multiple weapons, persistence, mobile controls, settings menu, i18n.

Those are Stage 2 and 3. Building them early is the single failure mode I care about. Coloured rectangles are the correct Stage 1 art.

## Required structure — create exactly this

```
arena/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ eslint.config.js
├─ vitest.config.ts
├─ AGENTS.md
├─ CLAUDE.md
├─ ARCHITECTURE.md
├─ public/assets/.gitkeep
└─ src/
   ├─ main.ts                  bootstrap only, ~15 lines
   ├─ game.config.ts           Phaser.Types.Core.GameConfig
   ├─ constants/
   │  ├─ keys.ts               SceneKey, TextureKey as const objects + derived types
   │  ├─ balance.ts            every tunable number in the game
   │  └─ depths.ts             z-order enum
   ├─ core/                    ← zero Phaser imports, enforced by lint
   │  ├─ EventBus.ts
   │  ├─ ObjectPool.ts
   │  └─ math.ts
   ├─ components/
   │  ├─ Health.ts
   │  ├─ Weapon.ts
   │  └─ Controls.ts
   ├─ entities/
   │  ├─ Player.ts
   │  ├─ Enemy.ts
   │  ├─ Projectile.ts
   │  └─ XpGem.ts
   ├─ systems/
   │  ├─ System.ts             the interface
   │  ├─ SpawnSystem.ts
   │  ├─ CombatSystem.ts
   │  └─ PickupSystem.ts
   ├─ scenes/
   │  ├─ BootScene.ts
   │  ├─ PreloadScene.ts
   │  ├─ MenuScene.ts
   │  ├─ GameScene.ts
   │  ├─ HUDScene.ts
   │  └─ GameOverScene.ts
   ├─ data/
   │  ├─ schema.ts             zod schemas
   │  └─ waves.json
   └─ __tests__/
      ├─ Health.test.ts
      └─ ObjectPool.test.ts
```

## Architectural invariants — non-negotiable

1. **`src/core/**` never imports Phaser.** It is portable TypeScript. Enforce with an ESLint `no-restricted-imports` rule scoped to that path.
2. **Scenes wire, systems think, entities hold state.** A scene's `update()` iterates systems and nothing else. A system never touches the renderer. An entity never queries global state.
3. **All cross-cutting communication goes through the typed `EventBus`.** `HUDScene` must not hold a reference to `Player`. If you need a direct reference between two objects that aren't parent/child, that's a signal you need an event.
4. **Composition over inheritance.** `Player` and `Enemy` both own a `Health` instance; they do not share a base class beyond `Phaser.Physics.Arcade.Sprite`. Max one level of your own inheritance anywhere.
5. **Zero magic numbers outside `constants/balance.ts`.** Speeds, HP, damage, cooldowns, spawn rates, radii, colours — all of it. `balance.ts` is `as const` and typed.
6. **Projectiles, enemies, and XP gems are pooled** via `ObjectPool` from day one. No `new` inside `update()`, ever.
7. **Game content is data.** Wave definitions live in `waves.json`, parsed through a zod schema at preload. A malformed JSON file must fail loudly at boot, not silently at wave 7.
8. **`update` receives seconds, not milliseconds.** Convert once, in `GameScene.update()`. Every downstream `update(dt)` takes seconds.
9. **Every scene cleans up after itself** in a `SHUTDOWN` handler: destroy systems, clear the event bus, release pools. Restarting the game twice must not double-fire a single listener.
10. **`tsconfig.json` runs `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.** Zero `any`. Zero `@ts-ignore`. If Phaser's types fight you, write a narrow typed wrapper and comment why.

## Working protocol

Do this in two passes, and **stop between them.**

**Pass 1 — skeleton.** Create every file above. Config files complete and correct. Source files with real imports, real class and method signatures, real types, and `throw new Error('not implemented')` bodies where logic goes. `npm run typecheck` must pass. Then stop and show me the tree plus `EventBus.ts`, `System.ts`, and `GameScene.ts` in full.

**Pass 2 — implementation.** Only after I confirm. Fill in every body. `npm run dev` yields a playable game.

## Definition of done for Stage 1

- `npm install && npm run dev` opens a playable game, no console errors or warnings.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass clean.
- Adding a second enemy type in Stage 2 requires: one JSON entry, one entity file, zero edits to any scene.
- `ARCHITECTURE.md` explains the scene lifecycle, the system contract, the event catalogue, and names the exact file to touch for each of: new entity, new system, new wave, new scene.

## How to write

State each file's job in one line before its code. Comment the *why*, never the *what*. No emoji, no decorative banners, no `console.log` left in. If you disagree with an invariant, say so before you code — do not silently route around it.

---
