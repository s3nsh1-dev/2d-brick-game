# Stage 2 kickstart prompt — paste into a fresh agent session

---

**Stage 2** of the `arena` project. Stage 1 is complete and playable.

Read `AGENTS.md`, `CLAUDE.md`, and `ARCHITECTURE.md` before doing anything. Then read `src/systems/System.ts`, `src/core/EventBus.ts`, `src/core/ObjectPool.ts`, `src/scenes/GameScene.ts`, and `src/entities/Enemy.ts` so you are working against the code that exists rather than the code you would have written.

`ARCHITECTURE.md` is the authority on which stage is current — do not take this file's word for it.

**Do not rebuild, re-scaffold, or restructure Stage 1.** Stage 2 extends it. Every invariant in `AGENTS.md` still holds and Stage 2 adds four more (below).

## Precondition — verify before writing anything

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Then, separately, `npm run dev` and confirm an empty console. It is a long-running server, so
it cannot be the last link in an `&&` chain — the chain would never return.

If any of these fail, stop and report the failures. Do not begin Stage 2 on a broken baseline, and do not "fix it while you're in there" — I will clear them separately.

## Stage 2 goal

Stage 1 proved the architecture. Stage 2 proves it **survives contact with content**: art, sound, effects, enemy variety, and progression. If any of the additions below require editing a Stage 1 scene file, that is a finding — report it before working around it.

### A balance finding from Stage 1 that Stage 2 inherits

Standing still, the player does not die. Auto-aim clears the swarm at roughly the rate it
spawns: the weapon does ~37 dps against wave-5 grunts at 20–80 HP, arriving one per 0.6s from
a spawn ring ~640px out, so almost nothing reaches contact range. A stationary player survived
past wave 5 at full health in testing.

That matters here because the XP curve and upgrade pacing in Pass C are meant to answer a
difficulty ramp, and there currently isn't one — the wave table plateaus instead of escalating.
Decide whether Stage 2 fixes the curve in `waves.json` or leaves it; either is fine, but do not
tune upgrades against a difficulty curve that does not exist.

## New dependencies

None expected. If you believe one is required, stop and make the case first.

## Scope

### In

| Area        | Deliverable                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| Art         | Texture atlas replacing coloured rectangles; idle + walk + hit animations for player and enemies                   |
| Audio       | SFX for shoot, hit, enemy death, player damage, pickup, level-up; one looping music track; master/SFX/music volume |
| VFX         | Hit spark, death burst, pickup sparkle; floating damage numbers                                                    |
| Game feel   | Screen shake on player damage, hit-stop on enemy death, damage flash tint, knockback                               |
| Enemies     | Two additional types (a fast/fragile swarmer and a slow/tanky brute), fully data-driven                            |
| Progression | XP curve, level-up, pick-1-of-3 upgrade offers, stat modifiers                                                     |
| Persistence | Versioned localStorage save: high score, best wave, total runs                                                     |
| Flow        | Pause scene; upgrade scene that suspends gameplay                                                                  |

### Out — Stage 3, do not build, do not stub, do not add hooks for

Level editor, ECS refactor, web workers, pathfinding beyond direct chase, backend or leaderboard, boss enemies, multiple weapons, mobile controls, settings menu, achievements, i18n.

## Files Stage 2 adds

```
src/
├─ constants/
│  ├─ keys.ts                  EXTEND  + AtlasKey, AnimKey, AudioKey
│  └─ balance.ts               EXTEND  + enemy stats, upgrade values, xp curve, volumes, shake params
├─ core/                       (still zero Phaser imports — this is the invariant Stage 2 stress-tests)
│  ├─ SaveStore.ts             NEW  versioned, zod-validated, storage-agnostic via an injected adapter
│  ├─ StatBlock.ts             NEW  base + flat modifiers + multiplicative modifiers, computed on read
│  └─ xpCurve.ts               NEW  pure level/threshold math
├─ components/
│  ├─ Stats.ts                 NEW  owns the entity's StatBlocks, applies upgrade modifiers
│  ├─ Animator.ts              NEW  thin typed wrapper over Phaser animation state
│  └─ Health.ts                UNCHANGED  see "Health does not emit" below
├─ entities/
│  ├─ Enemy.ts                 REFACTOR  spawn() takes an EnemyDefinition; texture/size per type
│  └─ FloatingText.ts          NEW  pooled damage numbers
├─ systems/
│  ├─ AudioSystem.ts           NEW  subscribes to the bus, owns all sound playback
│  ├─ VfxSystem.ts             NEW  subscribes to the bus, owns particles + camera effects
│  └─ ProgressionSystem.ts     NEW  XP accumulation, level-up detection, upgrade offer generation
├─ scenes/
│  ├─ PreloadScene.ts          EXTEND  atlas + audio + animation registration
│  ├─ UpgradeScene.ts          NEW  launched over a paused GameScene
│  └─ PauseScene.ts            NEW
└─ data/
   ├─ enemies.json             NEW   three definitions
   ├─ upgrades.json            NEW
   ├─ waves.json               EXTEND  add entries for the new ids — the `enemy` field already exists
   └─ schema.ts                EXTEND  zod schemas for all of the above
```

### Corrections against the Stage 1 code that actually shipped

This map was written before Stage 1 existed. Three entries describe a codebase that is not
the one in the repo:

- **`waves.json` already references enemy ids.** Every spawn entry carries `"enemy": "grunt"`
  today, because the Stage 1 definition of done required a second enemy type to cost one JSON
  entry. The schema types it as a single-member literal; Stage 2 widens that to a union
  validated against `enemies.json`. This is smaller than "EXTEND" implies.
- **`Enemy` does not have hardcoded stats.** It already takes them per spawn:
  `spawn(x, y, maxHp, speed)`. The real refactor is widening that signature to a definition
  and moving texture and body size — currently fixed at construction from `balance.ts` — to
  be per-type.
- **Health does not emit.** `Health` is a dependency-free value object that `Player` and
  `Enemy` each build with `new Health(max)`, and it is unit-tested with no stubs at all.
  Giving it an event bus would change every construction site and every spec, to no end:
  `CombatSystem` is already the single place all damage resolves and already emits
  `player:health-changed` and `enemy:died`. Knockback and flash events belong there.

## New invariants — Stage 2 adds these to `AGENTS.md`

11. **Presentation is event-driven and one-directional.** No gameplay code calls `sound.play()`, `camera.shake()`, or spawns a particle. Gameplay emits a typed event; `AudioSystem` and `VfxSystem` are the only subscribers that touch presentation APIs. Deleting both systems must leave the game fully playable, silent and unadorned.

12. **Emitters and sounds are created once, at system init.** Never per-hit, never per-frame. `VfxSystem` holds a fixed set of pre-configured emitters and re-triggers them at a position. Same for `Phaser.Sound` instances.

13. **Identical SFX inside a short window are coalesced.** Killing forty enemies in one frame plays one death sound, not forty. Throttle window lives in `balance.ts`.

14. **Stats are computed, never mutated.** `StatBlock` keeps an immutable base plus a list of modifiers and recomputes on read. An upgrade appends a modifier. Removing a modifier must restore the exact original value — no accumulated float drift.

15. **Save data carries a schema version.** `SaveStore` validates with zod on read; on version mismatch it migrates if it can and discards if it cannot. Corrupt or foreign localStorage must never crash the boot sequence.

## Phaser 4 notes

- Check `node_modules/phaser/skills/` for the particles, audio, animation, and camera subsystems before writing against them. Your recall for these is Phaser 3 and particles in particular changed substantially — the emitter is now a Game Object created with `this.add.particles(x, y, texture, config)`. (Verified against the shipped `particles` skill: `this.add.particles()` returns a `ParticleEmitter` that extends `GameObject` and is added straight to the display list. There is no separate manager and no `createEmitter`.)
- Stage 1's "coloured rectangles" are real textures, baked in `PreloadScene.bakeSquareTexture` with `Graphics#generateTexture`. Note that v4 removed `Create.GenerateTexture` and `TextureManager.generate`, but `Graphics#generateTexture` survives — that is the whole reason the Stage 1 art pipeline works. The atlas replaces this method, not a set of files on disk.
- `TextureKey` in `constants/keys.ts` currently names the four baked squares. `AtlasKey`/`AnimKey` supersede it; delete it rather than leaving both.
- Browser autoplay policy blocks audio until a user gesture. Handle the unlock explicitly in `MenuScene`; do not assume `sound.play()` works at boot.
- `scene.pause()` halts the update loop but leaves the scene rendered; `scene.sleep()` also stops rendering. `UpgradeScene` and `PauseScene` want `pause`, so the frozen game stays visible underneath.
- Verify tween and timer behaviour across pause. A `Phaser.Time.TimerEvent` owned by a paused scene must not fire.

## Working protocol — three passes, stop between each

**Pass A — data-driven enemies.** Add `enemies.json`, its schema, refactor `Enemy` to build from a definition, add the swarmer and brute, and update `waves.json` to reference enemy ids. No art, no audio.

This pass is the architecture test. Report explicitly: **which scene or system files did you have to edit?**

Be precise about what "zero" can mean here, because the original phrasing set a target that
contradicts itself. `GameScene.create()` builds exactly one enemy pool from
`() => new Enemy(this)`, and one physics group to match. So:

- A new enemy **class** needs its own pool and group, which is a `GameScene` edit. Every
  time. That is not a seam that can be closed without a registry, and a registry for three
  types is the speculative generality this project exists to avoid.
- A new enemy **definition**, served by the one `Enemy` class, needs no `GameScene` edit at
  all.

The definition of done ("adding a fourth enemy type requires editing `enemies.json` and
`waves.json` and nothing else") is only reachable on the second route, so take it — and note
that this contradicts the file map's implied "one entity file per enemy type". The DoD wins;
the swarmer and brute are definitions, not classes.

Expect exactly one unavoidable scene edit in this pass: `PreloadScene` currently bakes four
fixed textures from `balance.ts`. It has to loop over the enemy definitions instead. That is a
one-time change — after it, a fourth enemy needs no code — but it is a scene edit and should be
reported as one rather than hidden.

**Pass B — presentation.** Atlas, animations, `Animator`, `AudioSystem`, `VfxSystem`, floating text, screen shake, hit-stop, damage flash, knockback. Gameplay behaviour must not change in this pass — same damage, same speeds, same wave timing.

Two items on that list are not presentation, and the "no behaviour change" rule collides with
them head-on:

- **Hit-stop** freezes the simulation. That *is* a change to timing, and it cannot live in
  `VfxSystem` without breaking invariant 11's "deleting both systems leaves the game fully
  playable" in spirit — the game would play at a different tempo with the system present.
- **Knockback** moves physics bodies, which changes where enemies are. That is gameplay.

Resolution: knockback and hit-stop are `CombatSystem`'s, driven by the same damage resolution
that already exists. Screen shake, damage flash, particles and floating text are `VfxSystem`'s.
The dividing line is not "does it look like juice" but "does deleting it change where anything
ends up". Both are therefore exempt from the no-behaviour-change rule; state the exemption
rather than quietly widening it.

Use placeholder art you generate procedurally or simple shapes packed into an atlas. Do not download assets, and do not ask me to supply art before you can proceed — the atlas _pipeline_ is the deliverable, not the pixels.

**Pass C — progression and flow.** `StatBlock`, `Stats`, `xpCurve`, `ProgressionSystem`, `upgrades.json`, `UpgradeScene`, `PauseScene`, `SaveStore`.

## Tests

Vitest still covers `src/core/` and `src/components/` only. Stage 2 requires new specs for:

- `StatBlock` — modifier stacking order, add/remove round-trip returns the exact base value, multiplicative and flat modifiers compose correctly.
- `xpCurve` — monotonic, no off-by-one at level boundaries.
- `SaveStore` — round-trip, version migration, corrupt JSON, absent key, quota-exceeded on write.

`SaveStore` takes a storage adapter as a constructor argument precisely so it is testable without `localStorage`. Do not import `window` into `core/`.

## Definition of done

- All four commands pass clean: `typecheck`, `lint`, `test`, `build`.
- `npm run dev` runs with an empty browser console.
- Adding a fourth enemy type requires editing `enemies.json` and `waves.json` and nothing else.
- Deleting `AudioSystem` and `VfxSystem` from the system array in `GameScene` leaves a fully playable game.
- Clearing localStorage and reloading works. Writing garbage into the save key and reloading works.
- 60fps with 200 enemies, 100 projectiles, and particles active.
- `ARCHITECTURE.md` updated: stage table marks Stage 2 complete, event catalogue extended with the new presentation events, and the "where do I add X" section covers a new enemy, a new upgrade, and a new sound.
- `AGENTS.md` updated with invariants 11–15.

## How to work

State each file's job in one line before its code. Comment the _why_. If Pass A reveals that the Stage 1 architecture leaks, say so plainly rather than absorbing the damage silently — that finding is more valuable to me than a clean-looking diff.

---
