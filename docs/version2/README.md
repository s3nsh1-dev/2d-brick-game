# Version 2 — Stage 2: feel and content

**What this folder is:** the development history of Stage 2 — the five passes, what each
delivered, the decisions made inside them, and the places where the plan and reality disagreed.

**What this folder is not:** the brief, and not a technical reference.

| For | Read |
|---|---|
| The brief Stage 2 was built against, with its ledger | [`../STAGE_2_INSTRUCTIONS.md`](../STAGE_2_INSTRUCTIONS.md) |
| How the code fits together today | [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) |
| The invariants, including 11–15 which Stage 2 added | [`../../AGENTS.md`](../../AGENTS.md) |
| Stage 1's history | [`../version1/`](../version1/README.md) |

---

## The pages

| # | Page | What it covers |
|---|---|---|
| 1 | [What Stage 2 proved](01-what-stage-2-proved.md) | The goal, the five-pass structure, and why the passes were split where they were |
| 2 | [Pass A — content and curve](02-pass-a-content-and-curve.md) | `enemies.json`, the schema factory, and a difficulty curve tuned by measurement |
| 3 | [Pass B — presentation](03-pass-b-presentation.md) | Baked animation frames, synthesised audio, particles, floating damage numbers |
| 4 | [Pass C — game feel](04-pass-c-game-feel.md) | Knockback and hit-stop, and the line between feel and gameplay |
| 5 | [Pass D — progression](05-pass-d-progression.md) | XP curve, computed stats, upgrades, and a menu over a paused game |
| 6 | [Pass E — persistence and flow](06-pass-e-persistence-and-flow.md) | Versioned saves, the pause screen, and closing the stage |
| 7 | [Difficulties and fixes](07-difficulties-and-fixes.md) | Everything that went wrong, including two places the brief contradicted itself |

---

## What Stage 2 added

| | Stage 1 | Stage 2 |
|---|---|---|
| Enemy types | 1 (`grunt`) | 3, as **definitions** in JSON — a fourth costs zero code |
| Waves | 5, plateauing | 10, escalating, tuned against the weapon's clear rate |
| Art | 4 static squares | 23 baked textures, 12 animations, still no image files |
| Audio | none | 6 SFX + a music loop, synthesised at boot, still no audio files |
| Effects | none | 3 particle emitters, floating damage numbers, screen shake, damage flash |
| Game feel | none | knockback, hit-stop |
| Progression | an XP counter | XP curve, levels, pick-1-of-3 upgrades, computed stats |
| Persistence | none | versioned, validated `localStorage` with a migration path |
| Scenes | 6 | 8 (`UpgradeScene`, `PauseScene`) |
| Tests | 50 across 5 files | 127 across 9 files |
| Runtime dependencies | `phaser`, `zod` | `phaser`, `zod` |

That last row is the one worth dwelling on. Everything above it was added without a single new
dependency, because the art is generated and the audio is arithmetic.

---

## Verification at the close of the stage

```
typecheck ✅   lint ✅ 0 warnings   test ✅ 127 passed / 9 files   build ✅ 0 warnings
browser console ✅ 0 errors, 0 warnings
```

Measured in the running game rather than asserted:

- A stationary player dies in **wave 3** (target: by wave 3).
- Knockback velocity points away from the player in **12 of 12** observations.
- The physics world froze on **12 of 240** sampled frames — hit-stop firing on kills.
- Taking a +25% damage upgrade moved the stat from **12 → 15**, with nothing else touched.
- Listener census identical across **two consecutive restarts**, zeros in between.
- Boot survived a cleared save, a valid save, and `{{{ not json` in the save key.
