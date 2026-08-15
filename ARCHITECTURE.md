# ARCHITECTURE

## Current stage

**Stage 3 — complete. The project is finished.** All three stages are done; `typecheck`,
`lint`, `test` (153 specs across 11 files) and `build` pass clean, and the production build
runs with an empty browser console. Last verified 2026-08-15.

Stage 1 was the playable core. Stage 2 added feel and content in five passes. Stage 3 was
**refinement and ship**, in six passes plus one addendum:

- **A** — a palette every colour references, and an arena with a floor, a wall, a vignette
  and a spawn telegraph, composited into one texture at boot.
- **B** — `src/ui/`, a widget kit, and every scene rebuilt on it; camera-fade transitions; a
  HUD that reacts.
- **C** — readability at two hundred enemies: enemies tint as they take damage, per-frame
  effect budgets, three distinguishable moments.
- **G** — *the owner's gameplay addendum*, out of Stage 3's own scope and separated for that
  reason: waves 11–15, a victory condition, and a health pickup. See invariant 16.
- **D** — the performance budget measured for the first time since Stage 1, and three
  optimisations declined on the evidence.
- **E** — options and accessibility, reversing the "no settings menu" decision.
- **F** — production hardening, the page around the game, and a deploy-ready build. The game
  is **not** hosted: the owner's edit to the brief asked for readiness without a deploy, and
  the runbook is `docs/version3/deployment.md`.

An earlier Stage 3 would have moved the simulation out of Phaser. It was cancelled
deliberately; `docs/STAGE_3_instructions.md` §2 records why and what it costs. Determinism,
replay and server-validated scores are permanently out rather than deferred. Mobile controls,
i18n and multiplayer were never planned and still are not.

The per-pass history, including what went wrong, is `docs/version3/`.

## The shape of a frame

```
GameScene.update(time, delta)
  dt = min(delta / 1000, BALANCE.time.maxDeltaSeconds)   <- the simulation's ms→s
  combat.tickHitStop(dt) ? pause physics world, return   <- the frame does not happen
  player.update(dt)                                       <- input becomes velocity
  SpawnSystem.update(dt)                                  <- wave timeline, enemies enter
  CombatSystem.update(dt)                                 <- pursuit, firing, projectile age
  PickupSystem.update(dt)                                 <- gem magnet, pickup life
  ProgressionSystem.update(dt)                            <- nothing; levels are event-driven
  AudioSystem.update(dt)                                  <- sfx throttle clocks
  VfxSystem.update(dt)                                    <- text and markers age, budgets reset
  (Phaser then steps the physics world and runs colliders)
```

**Hit-stop is the one thing above the player.** `CombatSystem` owns the clock, because it
owns the death that starts it, but the scene has to ask before deciding whether the frame
happens at all. Skipping the systems alone would not be a freeze: Phaser steps the physics
world after `update` returns, so every body would keep drifting through the pause. The scene
pauses the world to match, which is wiring an engine call to a decision a system made — not
a rule of its own.

`HUDScene` runs its own clock in parallel and converts its own delta — the health bar drains
and the hit flash decays by `dt` like everything else. That is the second and only other
ms-to-seconds conversion in the codebase; it is not downstream of `GameScene`, and inventing
a bus event to carry `dt` across would have honoured the letter of invariant 8 while
defeating its point.

`dt` is seconds everywhere below this line. The cap exists so that a tab restored after
thirty seconds in the background advances one modest step instead of teleporting every body
through every other body.

Player movement is ticked directly by the scene rather than by a system. Stage 1 defines
exactly three systems and none of them is a natural home for input; adding a fourth would be
building past the stage. This is the one place the scene touches an entity per frame.

## Scene lifecycle

| Scene | Job | Leaves to |
|---|---|---|
| `BootScene` | Loads the saved settings, because the preloader bakes art whose colours they decide. The seam Stage 1 left for exactly this. | `PreloadScene` |
| `PreloadScene` | Loads and validates the three JSON files; composites the arena into one `DynamicTexture`; bakes five frames per actor **per palette**, plus projectile, gem, spark, spawn marker and the health cross; registers every animation. | `MenuScene` |
| `MenuScene` | Title card, records, and the way into options. Any key starts a run. | `GameScene` |
| `GameScene` | Builds the world, owns the pools and systems, runs the frame. | `GameOverScene` |
| `HUDScene` | Runs in parallel with `GameScene`. Draws health with digits, XP toward the next level, level, wave N of M, and the run's upgrades. Owns one clock, for the bar drain. | stopped by `GameScene` |
| `UpgradeScene` | Pick-1-of-3, layered over a **paused** `GameScene`. Resumes it on choice. | resumes `GameScene` |
| `PauseScene` | Escape. Layered over a paused `GameScene` the same way. Shows no run stats: the HUD is above it and undimmed. | resumes `GameScene` |
| `GameOverScene` | Final stats, the persisted records, and restart. Reports a win differently from a death. | `GameScene` |
| `OptionsScene` | Volumes and accessibility. Replaces whichever screen opened it and returns there. | `MenuScene` or `PauseScene` |

`UpgradeScene` and `PauseScene` use `scene.pause()`, never `scene.sleep()`: a paused scene
stops updating but keeps rendering, so the frozen arena stays visible under both. Each
resumes `GameScene` itself, because a paused scene cannot act on the signal that would tell
it to wake up.

**No `Phaser.Time.TimerEvent` and no tween exists anywhere in the game** — still true after
Stage 3, and checked rather than assumed — which is why pausing is safe rather than delicate.
Every clock in the codebase — spawn intervals, weapon cooldown, contact cooldown, knockback,
hit-stop, floating text, SFX throttles, the health pickup's life, the HUD's drain — is a
number decremented by `dt` inside something the scene stops calling. A paused scene therefore
cannot have a timer fire behind its back, because there are none to fire.

**Stage 3 added transitions without breaking that.** Menu, game and game-over fade through
their own camera and `UpgradeScene` blooms in from the accent colour, but a camera effect
belongs to one scene's camera and dies with that scene. It is also why the level-up bloom
lives in `UpgradeScene` rather than in `VfxSystem`: the run pauses the instant a level lands,
and a camera effect on a paused scene freezes mid-effect and stays there.

`GameScene` launches `HUDScene` in parallel and stops it again when the run ends. `HUDScene`
holds no reference to `GameScene`, to `Player`, or to anything inside the run — every number
it draws arrives as a bus event, and it seeds itself with the run's starting values so it
does not care whether it boots before or after the first frame.

**`GameScene` lifts the HUD above whichever sheet it launches.** A launched scene renders on
top of every scene started before it, so without `bringToTop` the pause and level-up scrims
would dim the player's own health, level and upgrade list along with the arena. Those are
exactly the numbers worth reading while choosing an upgrade, which is why neither sheet
repeats them.

### Shutdown

Every scene registers a `Phaser.Scenes.Events.SHUTDOWN` handler. `GameScene`'s handler runs
in this order, and the order is load-bearing:

1. calls `destroy()` on each system, which unsubscribes it from the bus;
2. calls `eventBus.clear()`;
3. empties the system array;
4. calls `releaseAll()` on each pool;
5. stops `HUDScene`.

Listener hygiene comes first because anything that throws later in the handler would skip
it, and a bus listener surviving a restart is the exact bug this ordering prevents. It is
not hypothetical: step 4 threw during development and took steps 2 and 5 with it.

**Phaser tears its own plugins down before this handler runs.** By the time `SHUTDOWN`
fires, the Arcade Physics plugin has already released every body, so `sprite.body` is
`undefined` and `disableBody()` would dereference it. Each entity's `despawn()` therefore
guards on `this.body` before touching it. Phaser's types have always declared `body`
nullable; the guard is honouring that, not defending against a phantom.

The invariant is verified by measurement rather than by eye. Driving `run:ended` through the
real path and reading `eventBus.listenerCount` across two consecutive restarts gives an
identical census each run — `player:health-changed` 1, `wave:started` 2, `xp:changed` 2,
`enemy:died` 1, `run:ended` 1 — and zero between runs.

## The system contract

```ts
interface System {
  update(dt: number): void;   // dt in seconds
  destroy(): void;            // unsubscribe, drop references
}
```

Systems think. They read entity state, decide, and write entity state. They never touch the
renderer, never create a game object with `new`, and never reach for a scene.

| System | Owns |
|---|---|
| `SpawnSystem` | The wave timeline. Acquires enemies and places them on the off-screen ring. |
| `CombatSystem` | The fight loop: enemy pursuit, weapon cooldown and auto-aim, projectile lifetime, damage in both directions, death, **knockback and hit-stop**. |
| `PickupSystem` | Gems: spawning them on death, pulling them in, converting them to XP. |
| `ProgressionSystem` | Levels: turning an XP total into a level, offering three upgrades, applying the chosen one. |
| `AudioSystem` | Every sound. Synthesises the whole set at init, throttles repeats, plays the music loop. |
| `VfxSystem` | Every particle, camera effect and damage number. |

The last two are **presentation**, and they are the only systems that touch a Phaser API at
runtime. That is deliberate and it is the one place the folder's "no runtime Phaser" habit is
broken on purpose — see the note in `docs/STAGE_2_INSTRUCTIONS.md` §9, item 3. The three
gameplay systems above them still import Phaser not at all.

Knockback and hit-stop live in `CombatSystem` rather than `VfxSystem` because of a single
test: **does deleting it change where anything ends up?** Screen shake, damage flash,
particles and floating text do not — delete them and every body is in the same place on the
same frame. Knockback moves bodies and hit-stop stops time, so both are gameplay wearing a
juice costume.

Enemy pursuit sits in `CombatSystem` rather than in a movement system for the same reason
player input sits in the scene: Stage 1 permits three systems, and pursuit belongs with the
damage exchange more naturally than with the wave timeline.

## Pools and physics groups

Both exist, and they track different things:

- **`ObjectPool<T>`** (`src/core/`) owns the active/free split. It constructs every object in
  its constructor — invariant 6 forbids `new` in an update path, and a lazily-filling pool
  only defers the allocation.
- **`Phaser.Physics.Arcade.Group`** is what the colliders are registered against. Every
  pooled sprite joins its group once, at construction, and never leaves.

Nothing is added to or removed from a group at runtime. `release` swap-removes from the
pool's active list, so a system releasing objects while iterating `pool.active` must walk it
backwards. That contract is pinned by a test.

## Event catalogue

The typed bus in `src/core/EventBus.ts` is the only channel between things that do not own
each other. Payloads are positional primitives, never entities: an event carrying an entity
would force `core/` to name a type from `entities/`, and Phaser would leak into the one
directory that must stay portable.

| Event | Payload | Emitted by | Heard by |
|---|---|---|---|
| `wave:started` | `waveNumber` | `SpawnSystem` | `HUDScene`, `CombatSystem`, `PickupSystem` |
| `player:health-changed` | `current`, `max` | `CombatSystem`, `PickupSystem` | `HUDScene` |
| `enemy:died` | `x`, `y` | `CombatSystem` | `PickupSystem`, `AudioSystem`, `VfxSystem` |
| `xp:changed` | `total` | `PickupSystem` | `HUDScene`, `CombatSystem`, `ProgressionSystem` |
| `waves:cleared` | — | `SpawnSystem` | `CombatSystem` |
| `run:ended` | `waveReached`, `xpTotal`, `victory` | `CombatSystem` | `GameScene` |
| `enemy:spawned` | `x`, `y` | `SpawnSystem` | `VfxSystem` |
| `enemy:damaged` | `x`, `y`, `amount` | `CombatSystem` | `AudioSystem`, `VfxSystem` |
| `player:damaged` | `x`, `y`, `amount` | `CombatSystem` | `AudioSystem`, `VfxSystem` |
| `weapon:fired` | `x`, `y` | `CombatSystem` | `AudioSystem` |
| `gem:collected` | `x`, `y` | `PickupSystem` | `AudioSystem`, `VfxSystem` |
| `pickup:health` | `x`, `y` | `PickupSystem` | `AudioSystem`, `VfxSystem` |
| `level:up` | `level`, `offerA`, `offerB`, `offerC` | `ProgressionSystem` | `GameScene`, `AudioSystem` |
| `upgrade:chosen` | `upgradeId` | `UpgradeScene` | `ProgressionSystem`, `GameScene`, `HUDScene` |
| `options:changed` | — | `OptionsScene` | `AudioSystem` |

Five of those are Stage 3's, and each earns its place differently:

- **`enemy:spawned`** is presentation only — `VfxSystem` marks the wall an enemy is about to
  cross. It is bounded by the spawn intervals in `waves.json`, the slowest clocks in the game.
- **`waves:cleared`** carries nothing and says only that the timeline is exhausted.
  `SpawnSystem` knows when it has issued every spawn; only `CombatSystem` knows whether the
  board is empty, because it owns the deaths. Splitting it that way is what keeps the win
  condition from needing a system to reach into another.
- **`run:ended`** grew a `victory` flag rather than gaining a sibling event, so there is
  still exactly one way for a run to end and one place that decides.
- **`pickup:health`** is the health pickup's presentation event, and the reason
  `player:health-changed` now has two emitters. The event states a fact about the player, not
  about combat; two emitters of one fact is a far smaller thing than a direct reference
  between two systems that do not own each other.
- **`options:changed`** exists because a volume change has to be audible *immediately* from a
  screen opened over a paused run — and a paused scene's systems do not tick. A bus listener
  is a plain function call and does not care what is frozen underneath it.

`level:up` lost `HUDScene` as a listener, which fixed a real bug. The HUD used to paint the
level only when that event fired, and it stops firing once fewer than three upgrades remain
uncapped — so a long run showed a level frozen in the low twenties. The HUD now derives the
level from `core/xpCurve` applied to the XP total, which is the same pure function
`ProgressionSystem` uses on the same input. Two readings of one number cannot disagree if
only one of them is a computation.

The four presentation events exist so `AudioSystem` and `VfxSystem` can react without
gameplay knowing either exists. Each is bounded by a cooldown — `weapon:fired` by the
weapon's, `enemy:damaged` by the projectiles that cooldown produces, `player:damaged` by the
per-enemy contact interval — which is what keeps them safe on a bus whose `emit` allocates a
rest-argument array. The collision callbacks beside them are still direct calls, because
those fire per contact per frame.

`level:up` carries its three offers as positional ids rather than an array: pick-1-of-3 is
the design rather than a parameter, and an array payload would allocate.

### What does not go through the bus

Physics collision callbacks call `CombatSystem` and `PickupSystem` methods directly. Those
callbacks fire per contact per frame — an event per bullet impact would allocate an argument
array in the hottest path in the game. `GameScene` owns both systems, so the call is a
parent reaching into its child, not the cross-cutting traffic the bus exists for.

`CombatSystem` tracks the current wave and XP total off the bus so it can put a complete run
summary into `run:ended`. It is the system that ends the run, so it is the system that
reports on it.

## Content vs balance

Three files hold numbers, and the split is deliberate. A finished enemy stat is
**base × definition × wave**:

- **`src/constants/balance.ts`** — the unit enemy and the rest of the tunables. Base HP and
  speed, contact damage, the weapon's damage and cooldown, pool sizes, the arena dimensions.
- **`src/data/enemies.json`** — how the types differ from one another. Per definition: an
  `id`, a body `size`, a hex `color`, and `hpScale`/`speedScale` against the base. The
  grunt is 1×1; the swarmer is fast and fragile, the brute slow and tanky.
- **`src/data/waves.json`** — escalation. Per wave: a duration, and spawn entries giving an
  enemy id, a count, an interval, and a further `hpScale`/`speedScale`.
- **`src/data/upgrades.json`** — what a level-up may offer. Per upgrade: the stat it touches,
  whether it is flat or a multiplier, its amount, its stack cap and its weight. The `stat`
  field is validated against `constants/stats.ts`, so an upgrade pointing at a stat that does
  not exist fails at boot rather than doing nothing when a player picks it.

Base stats are balance. Type identity and escalation are content, and only content belongs
in a data file.

Both JSON files are validated by `src/data/schema.ts` with `.parse()`, never `.safeParse()`,
in `PreloadScene`. Malformed content crashes at boot rather than producing an empty wave 7.
Enemies are parsed first because the wave schema is a **factory**: the `enemy` field is a
union over the ids `enemies.json` actually defines, so a wave naming a type that does not
exist fails at boot with the exact path and the list of ids that would have worked.

### The shape of the curve

The weapon's ceiling is 12 damage every 0.32s — 37.5 dps. A wave whose incoming HP/second
exceeds that builds a backlog, and the backlog is what reaches the player. The table is
tuned against that number rather than by eye:

- Waves 1–2 stay under the ceiling, so nothing reaches a player who never moves.
- Wave 3 spikes over it in a burst, which is what kills a stationary player.
- Waves 4–7 exceed it by a widening margin, but in bursts short enough that a moving player
  clears the backlog in the lull that follows.
- Waves 8–10 are continuously over it; wave 10 runs at roughly seven times the weapon's
  clear rate and is not meant to be survivable without the progression Pass D adds.

Slow mass (grunts, brutes) punishes standing still and is evadable by a moving player.
Swarmers are the pressure on a moving player, which is why their `speedScale` climbs late
rather than early.

## Which file do I touch?

| I want to… | Touch |
|---|---|
| Add an entity | A new file in `src/entities/`, its stats in `constants/balance.ts`, a pool and group in `GameScene.create()`. |
| Add an upgrade | `src/data/upgrades.json`. Nothing else, as long as it names a stat that exists. |
| Add a stat an upgrade can touch | `constants/stats.ts`, a block in `components/Stats.ts`, and the consumer that reads it. |
| Add a sound | A tone spec in `BALANCE.audio.sfx`, a key in `SoundKey`, a subscription in `AudioSystem`. No files. |
| Add a visual effect | An entry in `BALANCE.vfx`, an emitter built once in `VfxSystem`'s constructor, a subscription to trigger it. |
| Add an animation state | `core/animKeys.ts` — the frame count and the vocabulary — then whatever plays it. `PreloadScene` bakes what the map names. |
| Add an enemy type | `src/data/enemies.json`, then name it in `src/data/waves.json`. Nothing else. The definition's `id` is its texture key, `PreloadScene` bakes whatever the file lists, and one `Enemy` class serves every type. A new enemy *class* is a different question — it would need its own pool and group in `GameScene.create()`, which is why the swarmer and the brute are definitions instead. |
| Add a system | A new file in `src/systems/` implementing `System`, constructed and pushed in `GameScene.create()`. |
| Add a wave | `src/data/waves.json`. Nothing else. |
| Change how hard the game is | `src/constants/balance.ts` for base stats, `waves.json` for the curve. |
| Add a scene | A new file in `src/scenes/`, its key in `constants/keys.ts`, its class in `game.config.ts`. |
| Add a cross-cutting signal | A line in the `GameEvents` interface, then emit and subscribe. Update the table above. |
| **Change how the game looks** | `BALANCE.palette` for any colour, `BALANCE.ui` for any size or spacing. Both are read by `src/ui/`, so one edit restyles every scene. The arena itself is `PreloadScene.bakeArena`. |
| **Add a UI widget** | A file in `src/ui/`, composed from `Panel` and `Label`. Scenes position it; the widget decides how it looks. Do not add one until a second scene needs it — Stage 3's kit was built for the screens that exist. |
| **Add an option** | A field on `Settings` in `core/settings.ts` (the zod schema is the type), a row in `OptionsScene.buildRows`, and a reader. Bump `SAVE_VERSION` and add a migration if the shape changes. |
| **Change what an effect costs at scale** | `BALANCE.vfx.budget`. The events still fire and the gameplay still resolves; only the drawing is capped. |
| **Re-measure performance** | Set `BALANCE.debug.startWave` to 8, `npm run build && npm run preview`, and see the method recorded in `AGENTS.md`. |

## Known deviations from the letter of the spec

- `src/__tests__/` holds five test files, not the two named in `docs/KICKSTART.md`.
  `AGENTS.md` says Vitest covers `src/core/` and `src/components/`, and the broader rule was
  chosen deliberately. `Controls.ts` remains untested because it imports Phaser.
- `vite.config.ts` raises `build.chunkSizeWarningLimit`. Phaser is a ~1.5 MB module graph
  with no useful split point, and `AGENTS.md` requires a warning-free build. Stage 3 measured
  the one available alternative and declined it; the comment in that file carries the numbers.
- **`core/settings.ts` imports `constants/balance`** — the only file in `core/` that imports
  anything from `src/`. The alternative was a second copy of the three default volumes,
  drifting from the ones the audio system actually starts at. `constants/` holds no logic and
  imports nothing, so the portability invariant is untouched: `core/` still runs in a bare
  Node test with no DOM, which the 153 specs demonstrate.
- **Invariant 16 has one deliberate exception**, the owner's gameplay addendum. `AGENTS.md`
  invariant 16 records what it covers and what evidence survives it.
