# Stage 2 — the brief

**Self-contained.** Pointing a fresh session at this file, with no other context, is enough to
start work correctly. Everything you need to know about where the project stands, what is
already built, what Stage 2 must deliver, and what "done" means is below.

---

## 0. Orient

Read, in this order, before writing anything:

1. `AGENTS.md` — stack, directory map, invariants 1–10. The authority. If any other document
   contradicts it, it wins.
2. `CLAUDE.md` — how to work in this repo.
3. `ARCHITECTURE.md` — the authority on the current stage, the frame pipeline, the scene
   lifecycle, and the event catalogue.

Then read the code you are about to change, rather than planning against a summary:
`src/systems/System.ts`, `src/core/EventBus.ts`, `src/core/ObjectPool.ts`,
`src/scenes/GameScene.ts`, `src/scenes/PreloadScene.ts`, `src/entities/Enemy.ts`,
`src/data/schema.ts`, `src/constants/balance.ts`, `src/constants/keys.ts`.

**Do not rebuild, re-scaffold, or restructure Stage 1.** Stage 2 extends it. Every invariant
in `AGENTS.md` still holds, and Stage 2 adds five more (§6).

### Precondition — verify before writing anything

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Then, separately, `npm run dev` and confirm an empty browser console. It is a long-running
server, so it cannot be the last link in an `&&` chain — the chain would never return.

Baseline as of 2026-08-14: `typecheck` ✅ · `lint` ✅ 0 warnings · `test` ✅ 50 passed across
5 files · `build` ✅ 0 warnings · console ✅ empty.

If any of these fail, stop and report. Do not begin Stage 2 on a broken baseline, and do not
"fix it while you're in there".

---

## 1. Status ledger — what exists, what does not

**As of 2026-08-14, no Stage 2 feature is implemented.** The branch is called `feature/stage2`
and contains only documentation and wave tuning. Verify it yourself in one command:

```bash
grep -rniE "upgrade|audiosystem|vfxsystem|statblock|savestore|xpcurve|animator|particle|shake|knockback|swarmer|brute|localstorage|enemies\.json" src/
```

Zero hits today. `src/data/schema.ts` still reads `export const enemyIdSchema = z.literal('grunt')`.

### 1a. Foundations already in place — build on these, do not rebuild them

These are Stage 1 deliverables that Stage 2 assumes. Each one is why a Stage 2 item is smaller
than it sounds.

| ✅ | Already true | Where | Why it matters to Stage 2 |
|---|---|---|---|
| ✅ | Enemy stats are supplied per spawn, not hardcoded | `Enemy.spawn(x, y, maxHp, speed)` | Pass A widens a signature; it does not introduce the idea |
| ✅ | Every `waves.json` spawn entry already names an enemy id | `spawnEntrySchema.enemy` | The `enemy` field exists. Pass A widens the **schema**, not the data shape |
| ✅ | Per-wave `hpScale` / `speedScale` multipliers | `spawnEntrySchema` | The escalation mechanism exists; only the numbers are flat |
| ✅ | Generic pooling with fixed capacity | `core/ObjectPool.ts` | `FloatingText` needs a pool, not a pooling system |
| ✅ | Typed event bus with 5 events, positional-primitive payloads | `core/EventBus.ts` | Presentation subscribes here. Adding an event is one line in `GameEvents` |
| ✅ | Boot-time texture baking with `Graphics#generateTexture` | `PreloadScene.bakeSquareTexture` | The art pipeline already exists. Pass B generalises it, see §4 |
| ✅ | zod validation at boot, `.parse()` not `.safeParse()` | `data/schema.ts`, `PreloadScene` | `enemies.json` and `upgrades.json` follow an established path |
| ✅ | `Health` is a dependency-free value object | `components/Health.ts` | Deliberately unchanged in Stage 2. See §5 |
| ✅ | Restart safety verified by listener census | `GameScene.shutdown` | New systems must extend the census, not invent a pattern |

### 1b. Stage 2 deliverables — every one of these is **not started**

Tick a row in this table **in the same commit** as the code that lands it.

| Status | Deliverable | Pass | Evidence it is not done |
|---|---|---|---|
| ☐ | `enemies.json` + `EnemyDefinition` + its zod schema | A | File does not exist |
| ☐ | `enemyIdSchema` widened from a literal to a union validated against `enemies.json` | A | Still `z.literal('grunt')` |
| ☐ | Per-definition texture, body size and colour | A | `Enemy` constructor hardcodes `TextureKey.ENEMY`; size comes from `BALANCE.enemy.size` |
| ☐ | Swarmer (fast, fragile) and brute (slow, tanky) as **definitions** | A | Only `grunt` exists |
| ☐ | **A real difficulty ramp and a real fail state** | A | Standing still, the player does not die. See §3 |
| ☐ | Per-frame textures + idle / walk / hit animations | B | No `AnimKey`, no `anims.create` anywhere |
| ☐ | `Animator` component | B | File does not exist |
| ☐ | SFX: shoot, hit, enemy death, player damage, pickup, level-up | B | No `AudioSystem`, no audio loaded |
| ☐ | One looping music track; master / SFX / music volume | B | As above |
| ☐ | Hit spark, death burst, pickup sparkle | B | No `VfxSystem`, no particle emitters |
| ☐ | Floating damage numbers | B | No `FloatingText` |
| ☐ | Screen shake on player damage, damage flash tint | B | No camera effects |
| ☐ | Knockback on hit | C | `CombatSystem` applies damage only |
| ☐ | Hit-stop on enemy death | C | Nothing modulates the timestep |
| ☐ | XP curve and levels | D | XP accumulates via `xp:changed`; there are no levels |
| ☐ | `StatBlock` + `Stats` (computed, never mutated) | D | Files do not exist |
| ☐ | `upgrades.json` + pick-1-of-3 offers | D | File does not exist |
| ☐ | `UpgradeScene` | D | Six scenes exist; this is not one of them |
| ☐ | Versioned, zod-validated `SaveStore`: high score, best wave, total runs | E | File does not exist; nothing touches `localStorage` |
| ☐ | `PauseScene` | E | Does not exist |
| ☐ | `AGENTS.md` carries invariants 11–15 | E | Stops at 10 |
| ☐ | `ARCHITECTURE.md` updated: stage table, event catalogue, "which file do I touch" | E | Describes Stage 1 |

**Partial credit is not a status.** A row is ☐ until its code is merged and all four checks
pass.

---

## 2. What Stage 2 is

Stage 1 proved the architecture. **Stage 2 proves it survives contact with content**: art,
sound, effects, enemy variety, and progression.

Stage 2 is **additive**. It adds things on top of the existing structure and changes none of
it. The one place it deliberately changes gameplay is Pass C, and that pass exists separately
precisely so the change is visible. If any addition below requires editing a Stage 1 scene
file, that is a finding — report it before working around it. (One such edit is expected and
named in §7, Pass A.)

By contrast, Stage 3 changes what the program *is*. Do not borrow from it. See §10.

---

## 3. The mandatory balance fix

**This was previously optional. It is not.**

Standing completely still, the player does not die. Auto-aim clears the swarm at roughly the
rate it spawns: the weapon does ~37 dps against wave-5 grunts at 20–80 effective HP, arriving
one per 0.6s from a spawn ring ~640px out, so almost nothing reaches contact range. A
stationary player survived past wave 5 at full health in testing.

Pass D ships an XP curve and upgrade pacing, and both are answers to a difficulty ramp.
**There is currently no ramp to answer.** Tuning upgrades against a flat curve produces
numbers that mean nothing, and you will not find out until you have built the whole
progression system on top of them. So the curve is fixed first, in Pass A, before any of it.

Targets, so the fix is checkable rather than a matter of taste:

- A player who never moves **dies by wave 3**.
- A player who moves competently but takes no upgrades **dies somewhere in waves 5–8**.
- The wave table **extends past 5 and escalates on the last entry** rather than holding. Ten
  waves is a reasonable target.
- Escalation comes from `waves.json` — counts, intervals, `hpScale`, `speedScale`, and the mix
  of enemy definitions. Base stats stay in `balance.ts`. That split is architectural; do not
  blur it to make the tuning easier.

Do this **after** the swarmer and brute exist, in the same pass. Enemy variety is the lever the
curve is tuned with, and tuning grunt-only waves twice is wasted work.

---

## 4. Two corrections to this document's own scope, from reading the Phaser 4 skills

The scope table used to say "texture atlas" and "handle the audio unlock explicitly". Both were
written against assumptions that the shipped `node_modules/phaser/skills/` contradict.

### 4a. No packed atlas. Bake one texture per frame.

An atlas exists to stop batch breaks across **many separate source images**. This project has
no source images. All art is baked at boot from a single `Graphics` object into solid-colour
squares, and packing four squares into a strip saves nothing measurable.

Verified in the shipped skills:

- `graphics-and-shapes/SKILL.md` documents `generateTexture(key, width, height)` in v4 — the
  call `PreloadScene` already uses. It notes the Canvas backing, which is why gradient fills
  do not survive it. Solid fills do.
- `animations/SKILL.md` documents an explicit frame array where **each frame names its own
  texture key**: `frames: [{ key: 'fighter', frame: 'punch1', duration: 50 }, …]`. So an
  animation can be composed from separately baked textures with no atlas and no spritesheet.
- `generateFrameNumbers` is for spritesheets, `generateFrameNames` for atlases. Neither is
  needed here.
- The skills do **not** document `TextureManager.addSpriteSheet` or `addAtlas`. If you want
  the packed route anyway, verify those exist in `node_modules/phaser/types/` first — and
  expect them to buy nothing at this scale. Sprite-count batching is a Stage 3 problem.

**So the Pass B deliverable is the pipeline, not the pixels:** a boot-time loop that bakes N
frames per enemy definition, an `AnimKey` map, `anims.create` calls composing those frames, and
an `Animator` component wrapping playback. That is the thing worth building. Do not download
assets, and do not ask for art before you can proceed.

`TextureKey` in `constants/keys.ts` currently names the four baked squares. `AnimKey` and a
per-definition frame-key scheme supersede it — **delete `TextureKey`, do not leave both.**

### 4b. Do not hand-roll the audio unlock, and do not ship audio files.

`audio-and-sound/SKILL.md` is explicit: *"You do not need to handle unlocking manually."*
Phaser listens for `touchstart`/`touchend`/`mousedown`/`mouseup`/`keydown` on `document.body`
and resumes the `AudioContext` itself. The previous instruction to unlock explicitly in
`MenuScene` was wrong — delete that idea. If you need to know when audio is ready, read
`this.sound.locked` and listen once for the `UNLOCKED` event.

For the sounds themselves, the same principle as the textures applies: **synthesize them at
boot, ship no files.** The skill documents `this.sound.decodeAudio(key, base64StringOrArrayBuffer)`,
and a batch form `this.sound.decodeAudio([{ key, data }, …])`. Write short PCM buffers into a
WAV container in portable TypeScript, decode them at boot, and the repo stays asset-free —
which is currently one of its properties and worth keeping.

The synthesis itself has no Phaser in it, so it belongs in `core/`. That makes it unit-testable
and it is a genuine, non-speculative use of invariant 1.

---

## 5. Corrections against the Stage 1 code that actually shipped

The original file map predates Stage 1. Three of its entries describe a codebase that is not
in this repo.

- **`waves.json` already references enemy ids.** Every spawn entry carries `"enemy": "grunt"`
  today, because Stage 1's definition of done required a second enemy type to cost one JSON
  entry. The schema types it as a single-member literal; Stage 2 widens that to a union
  validated against `enemies.json`. Smaller than "EXTEND" implies.
- **`Enemy` does not have hardcoded stats.** It already takes them per spawn:
  `spawn(x, y, maxHp, speed)`. The real refactor is widening that signature to a definition and
  moving **texture and body size** — currently fixed at construction from `balance.ts` — to be
  per-type.
- **`Health` does not emit, and must not start.** It is a dependency-free value object that
  `Player` and `Enemy` each build with `new Health(max)`, unit-tested with no stubs at all.
  Giving it an event bus would change every construction site and every spec to no end:
  `CombatSystem` is already the single place all damage resolves and already emits
  `player:health-changed` and `enemy:died`. Knockback, flash and damage-number events belong
  there.

---

## 6. New invariants — Stage 2 adds these to `AGENTS.md`

**Exactly five, numbered 11–15.** Stage 3 numbers its own from 16 and depends on that count. If
you end up adding a sixth, say so explicitly so Stage 3 can be renumbered rather than left
with a collision.

11. **Presentation is event-driven and one-directional.** No gameplay code calls
    `sound.play()`, `camera.shake()`, or spawns a particle. Gameplay emits a typed event;
    `AudioSystem` and `VfxSystem` are the only subscribers that touch presentation APIs.
    Deleting both systems must leave the game fully playable, silent and unadorned.

12. **Emitters and sounds are created once, at system init.** Never per-hit, never per-frame.
    `VfxSystem` holds a fixed set of pre-configured emitters and re-triggers them at a
    position. Same for `Phaser.Sound` instances.

13. **Identical SFX inside a short window are coalesced.** Killing forty enemies in one frame
    plays one death sound, not forty. The throttle window lives in `balance.ts`.

14. **Stats are computed, never mutated.** `StatBlock` keeps an immutable base plus a list of
    modifiers and recomputes on read. An upgrade appends a modifier. Removing a modifier must
    restore the exact original value — no accumulated float drift.

15. **Save data carries a schema version.** `SaveStore` validates with zod on read; on version
    mismatch it migrates if it can and discards if it cannot. Corrupt or foreign
    `localStorage` must never crash the boot sequence.

---

## 7. The passes

Five passes. **One pass per session. Stop between each.** Do not prepare for a later pass
inside an earlier one — no `upgrades?: Upgrade[]` field "so Pass D is easier", no
`// TODO: particles here`.

### Pass A — content and curve

`enemies.json` and its schema; `EnemyDefinition`; `Enemy` refactored to build from a
definition; swarmer and brute; `enemyIdSchema` widened; **the difficulty ramp of §3**. No art,
no audio.

**This pass is the architecture test.** Report explicitly: *which scene or system files did you
have to edit?*

Be precise about what "zero scene edits" can mean, because the original phrasing set a target
that contradicts itself. `GameScene.create()` builds exactly one enemy pool from
`() => new Enemy(this)`, and one physics group to match. So:

- A new enemy **class** needs its own pool and group, which is a `GameScene` edit. Every time.
  That is not a seam you can close without a registry, and a registry for three types is the
  speculative generality this project exists to avoid.
- A new enemy **definition**, served by the one `Enemy` class, needs no `GameScene` edit at all.

The definition of done — *adding a fourth enemy type requires editing `enemies.json` and
`waves.json` and nothing else* — is reachable only on the second route, so take it. **The
swarmer and brute are definitions, not classes.** Note that this contradicts the old file map's
implied "one entity file per enemy type"; the DoD wins.

**Expect exactly one unavoidable scene edit.** `PreloadScene` bakes four fixed textures from
`balance.ts`. It has to loop over the enemy definitions instead. That is a one-time change —
after it, a fourth enemy needs no code — but it is a scene edit and must be reported as one
rather than hidden.

`ARCHITECTURE.md`'s "which file do I touch" table currently says a new enemy type is *not* a
cheap operation. Pass A is what makes that row false; update it in the same commit.

**Done when:** a fourth enemy type is two JSON edits; a stationary player dies by wave 3; all
four checks pass.

### Pass B — presentation

Baked frame textures, `anims.create` definitions, `Animator`, `AudioSystem`, `VfxSystem`,
`FloatingText`, screen shake, damage flash. Read §4 before starting — two of these are not the
things this document originally said they were.

**Gameplay behaviour must not change in this pass.** Same damage, same speeds, same wave
timing, same run length. That claim is checkable precisely because knockback and hit-stop are
held back to Pass C.

New bus events will be needed — damage dealt with a position, level-up, pickup. Add them to the
`GameEvents` map, and add a row to the catalogue in `ARCHITECTURE.md` for each. Payloads stay
positional primitives: an event carrying an entity would force `core/` to name a type from
`entities/`, and Phaser would leak into the one directory that must stay portable.

**Done when:** deleting `AudioSystem` and `VfxSystem` from the system array in `GameScene`
leaves a fully playable, silent, unadorned game with identical timing.

### Pass C — game feel

Knockback and hit-stop, both in `CombatSystem`. Small — an hour or so. It is a separate pass
because it is the one place Stage 2 deliberately changes gameplay.

Two items on the original "game feel" list are not presentation, and the no-behaviour-change
rule collides with them head-on:

- **Hit-stop** freezes the simulation. That *is* a change to timing, and it cannot live in
  `VfxSystem` without breaking invariant 11 in spirit — the game would play at a different
  tempo with the system present.
- **Knockback** moves physics bodies, which changes where enemies are. That is gameplay.

The dividing line is **not** "does it look like juice". It is **"does deleting it change where
anything ends up"**. Screen shake, flash, particles and floating text do not; knockback and
hit-stop do. So they live in `CombatSystem`, driven by the damage resolution that already
exists there.

**Done when:** the feel changes, the four checks pass, and you can state in one sentence why
each of the four Pass B effects stayed in `VfxSystem` and these two did not.

### Pass D — progression

`core/xpCurve.ts`, `core/StatBlock.ts`, `components/Stats.ts`, `systems/ProgressionSystem.ts`,
`data/upgrades.json` and its schema, `scenes/UpgradeScene.ts`.

`UpgradeScene` launches over a **paused** `GameScene`. `scene.pause()` halts the update loop
but leaves the scene rendered; `scene.sleep()` also stops rendering. You want `pause`, so the
frozen game stays visible underneath. Verify that a `Phaser.Time.TimerEvent` owned by a paused
scene does not fire, and that tweens behave across the pause.

Upgrade-offer generation will introduce new `Math.random` call sites. Keep every one of them
inside `ProgressionSystem` — see §9, item 5.

**Done when:** levelling up offers three upgrades, taking one visibly changes a stat, and
adding a fourth upgrade is a single `upgrades.json` entry.

### Pass E — persistence, flow, and documentation

`core/SaveStore.ts`, `scenes/PauseScene.ts`, and the documentation updates that close the stage.

`SaveStore` takes a **storage adapter as a constructor argument**, precisely so it is testable
without `localStorage`. Do not import `window` into `core/`; the ESLint rule scoped to
`src/core/**/*.ts` bans Phaser, but portability is the actual requirement and the DOM breaks it
just as thoroughly.

**Done when:** clearing `localStorage` and reloading works; writing garbage into the save key
and reloading works; `AGENTS.md` carries invariants 11–15; `ARCHITECTURE.md` is updated; and
§1b of this file is all ✅.

---

## 8. Tests

Vitest covers `src/core/` and `src/components/`. Stage 2 requires new specs for:

- **`StatBlock`** — modifier stacking order; add-then-remove round-trips to the exact base
  value; flat and multiplicative modifiers compose correctly.
- **`xpCurve`** — monotonic; no off-by-one at level boundaries.
- **`SaveStore`** — round-trip; version migration; corrupt JSON; absent key; quota-exceeded on
  write.
- **The audio synthesis from §4b** — it is pure buffer maths in `core/`, so it tests like any
  other pure function.

`vitest.config.ts` is `environment: 'node'` deliberately. Anything you add to `core/` must pass
there, with no DOM shim.

---

## 9. The Stage 3 readiness gate

**This is the section that makes Stage 2 sufficient.** Stage 3 moves the entire simulation out
of Phaser. That plan assumes seven things, all of which Stage 2 either preserves or provides.
Check every one before declaring Stage 2 complete — each failure here is paid for with interest
in Stage 3.

1. **`enemies.json`, `upgrades.json` and their zod schemas exist**, and are the only source of
   enemy and upgrade content. Stage 3's editor pass edits these files; without them it has
   nothing to edit but waves.

2. **`src/core/` still has zero Phaser imports and zero DOM references.** Stage 2 adds
   `SaveStore`, `StatBlock`, `xpCurve` and the audio synthesis to it. Every one must run in a
   bare Node test. This is not a style rule in Stage 3 — the entire stage is built on it.

3. **Every gameplay rule lives in `src/systems/` or `src/components/`, and systems import
   entities with `import type` only.** Today `CombatSystem`, `PickupSystem` and `SpawnSystem`
   have **zero runtime Phaser imports**; their only entity coupling is erased at compile time.
   Stage 3 moves those files wholesale. Confirm before finishing:

   ```bash
   grep -rn "from 'phaser'" src/systems/     # must stay empty
   ```

   A single runtime `phaser` import added to a system during Stage 2 turns a file move into a
   rewrite.

4. **Presentation only ever subscribes.** Invariant 11 is not decoration — Stage 3's sim/view
   split is that invariant taken to its conclusion. If gameplay code calls `camera.shake()`
   directly anywhere, Stage 3 has to unpick it before it can start.

5. **Every `Math.random` call site is inside a system and countable.** Today there are exactly
   five, all in `SpawnSystem.spawn()` — the edge picker and four coordinate rolls. Stage 3
   routes them through a seeded generator. Stage 2 will legitimately add more in
   `ProgressionSystem` (upgrade offers). That is fine. What is not fine is randomness in an
   entity or a scene, where the seeding pass cannot reach it cleanly.

   Randomness in `VfxSystem` — particle jitter, spark angles — is exempt and should stay
   exempt, because it decides no gameplay outcome. Say so in a comment where you write it, or
   the Stage 3 seeding pass will waste a session deciding whether it matters.

6. **No `Date.now` or `performance.now` in any path that decides an outcome.** There are none
   in `src/` today. `SaveStore` may want a timestamp for save metadata; that is fine, it is
   persistence, not simulation. Keep it out of gameplay.

7. **Pool sizes stay fixed and nothing calls `new` in an update path.** Stage 3 rebuilds the
   world as flat arrays; a codebase that already never allocates mid-frame makes that
   mechanical instead of archaeological.

If all seven hold, Stage 3 can begin at Pass A on the day Stage 2 lands.

---

## 10. Scope boundary — what Stage 2 does not touch

Stage 3, and explicitly **not** Stage 2. Do not build, do not stub, do not add hooks for:

npm workspaces or any package split · moving game rules out of Phaser · replacing Arcade
Physics with a custom integrator or broadphase · seeded RNG or determinism work · fixed
timestep and accumulator · replay recording · ECS or `bitecs` · web workers · pathfinding of
any kind beyond direct chase · arena obstacles or walls · level editor · backend, server, or
leaderboard.

And not planned for any stage: boss enemies · multiple weapons · mobile controls · settings
menu · achievements · i18n · online multiplayer.

`BALANCE.time.maxDeltaSeconds` stays exactly as it is. Stage 3 replaces it with an accumulator
clamp; Stage 2 does not anticipate that.

---

## 11. Phaser 4 notes

Your recall for Phaser is overwhelmingly v3, and v4 is a rewrite. Assume it is stale.

- `node_modules/phaser/skills/` ships **28 skill files**. For Stage 2 the relevant ones are
  `animations`, `audio-and-sound`, `particles`, `cameras`, `tweens`, `time-and-timers`,
  `scenes`, `graphics-and-shapes`, `render-textures` and `data-manager`. **Read the one you
  need before writing against that subsystem.**
- `node_modules/phaser/types/` is ground truth when a skill and your memory disagree.
- Particles changed substantially. The emitter is now a Game Object created with
  `this.add.particles(x, y, texture, config)`, added straight to the display list. There is no
  separate manager and no `createEmitter`. (Verified against the shipped `particles` skill.)
- `Graphics#generateTexture` survives in v4 even though `Create.GenerateTexture` and
  `TextureManager.generate` were removed. That is why the Stage 1 art pipeline works at all.
- `import * as Phaser from 'phaser'` — the default export was removed.
- Confidently writing a v4 API you have not verified is worse than saying "let me check the
  types first".

---

## 12. How to work

State each file's job in one line before its code. Comment the *why*, never the *what*.

Tick the §1b ledger in the same commit as the code. A stale status table in the file that
exists to report status is worse than no table.

If a pass reveals that the Stage 1 architecture leaks, **say so plainly** rather than absorbing
the damage silently. That finding is worth more than a clean-looking diff — §4 and §5 of this
document are both the product of exactly that, and both saved real work.

---
