# ARCHITECTURE

## Current stage

**Stage 2 — complete. Stage 3 not started.** All five passes are done; `typecheck`, `lint`,
`test` (127 specs across 9 files) and `build` pass clean, and the game runs with an empty
browser console. Last verified 2026-08-14.

Stage 1 was the playable core. Stage 2 added, in five passes: data-driven enemy definitions
and a real difficulty curve (A); baked frame animations, synthesised audio, particles,
floating damage numbers, screen shake and damage flash (B); knockback and hit-stop (C); an XP
curve, levels, computed stats and pick-1-of-3 upgrades (D); versioned persistence and a pause
screen (E).

Stage 3 changes what the program *is* — the simulation stops depending on Phaser. Nothing in
this repo anticipates it beyond the readiness gate in `docs/STAGE_2_INSTRUCTIONS.md` §9.
Mobile controls, settings, i18n and multiplayer are not planned for any stage.

## The shape of a frame

```
GameScene.update(time, delta)
  dt = min(delta / 1000, BALANCE.time.maxDeltaSeconds)   <- the only ms→s conversion
  combat.tickHitStop(dt) ? pause physics world, return   <- the frame does not happen
  player.update(dt)                                       <- input becomes velocity
  SpawnSystem.update(dt)                                  <- wave timeline, enemies enter
  CombatSystem.update(dt)                                 <- pursuit, firing, projectile age
  PickupSystem.update(dt)                                 <- gem magnet
  ProgressionSystem.update(dt)                            <- nothing; levels are event-driven
  AudioSystem.update(dt)                                  <- sfx throttle clocks
  VfxSystem.update(dt)                                    <- floating damage numbers age
  (Phaser then steps the physics world and runs colliders)
```

**Hit-stop is the one thing above the player.** `CombatSystem` owns the clock, because it
owns the death that starts it, but the scene has to ask before deciding whether the frame
happens at all. Skipping the systems alone would not be a freeze: Phaser steps the physics
world after `update` returns, so every body would keep drifting through the pause. The scene
pauses the world to match, which is wiring an engine call to a decision a system made — not
a rule of its own.

`dt` is seconds everywhere below this line. The cap exists so that a tab restored after
thirty seconds in the background advances one modest step instead of teleporting every body
through every other body.

Player movement is ticked directly by the scene rather than by a system. Stage 1 defines
exactly three systems and none of them is a natural home for input; adding a fourth would be
building past the stage. This is the one place the scene touches an entity per frame.

## Scene lifecycle

| Scene | Job | Leaves to |
|---|---|---|
| `BootScene` | Nothing yet. The seam where boot-time configuration will go. | `PreloadScene` |
| `PreloadScene` | Loads and validates `enemies.json`, `waves.json` and `upgrades.json`; bakes five frames per actor plus the projectile, gem and spark; registers every animation. | `MenuScene` |
| `MenuScene` | Title card. Any key or click starts a run. | `GameScene` |
| `GameScene` | Builds the world, owns the pools and systems, runs the frame. | `GameOverScene` |
| `HUDScene` | Runs in parallel with `GameScene`. Draws HP, wave, XP and level. | stopped by `GameScene` |
| `UpgradeScene` | Pick-1-of-3, layered over a **paused** `GameScene`. Resumes it on choice. | resumes `GameScene` |
| `PauseScene` | Escape. Layered over a paused `GameScene` the same way. | resumes `GameScene` |
| `GameOverScene` | Final stats, the persisted records, and restart. | `GameScene` |

`UpgradeScene` and `PauseScene` use `scene.pause()`, never `scene.sleep()`: a paused scene
stops updating but keeps rendering, so the frozen arena stays visible under both. Each
resumes `GameScene` itself, because a paused scene cannot act on the signal that would tell
it to wake up.

**No `Phaser.Time.TimerEvent` and no tween exists anywhere in the game**, which is why
pausing is safe rather than delicate. Every clock in the codebase — spawn intervals, weapon
cooldown, contact cooldown, knockback, hit-stop, floating text, SFX throttles — is a number
decremented by `dt` inside something the scene stops calling. A paused scene therefore cannot
have a timer fire behind its back, because there are none to fire.

`GameScene` launches `HUDScene` in parallel and stops it again when the run ends. `HUDScene`
holds no reference to `GameScene`, to `Player`, or to anything inside the run — every number
it draws arrives as a bus event, and it seeds itself with the run's starting values so it
does not care whether it boots before or after the first frame.

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
| `wave:started` | `waveNumber` | `SpawnSystem` | `HUDScene`, `CombatSystem` |
| `player:health-changed` | `current`, `max` | `CombatSystem` | `HUDScene` |
| `enemy:died` | `x`, `y` | `CombatSystem` | `PickupSystem`, `AudioSystem`, `VfxSystem` |
| `xp:changed` | `total` | `PickupSystem` | `HUDScene`, `CombatSystem`, `ProgressionSystem` |
| `run:ended` | `waveReached`, `xpTotal` | `CombatSystem` | `GameScene` |
| `enemy:damaged` | `x`, `y`, `amount` | `CombatSystem` | `AudioSystem`, `VfxSystem` |
| `player:damaged` | `x`, `y`, `amount` | `CombatSystem` | `AudioSystem`, `VfxSystem` |
| `weapon:fired` | `x`, `y` | `CombatSystem` | `AudioSystem` |
| `gem:collected` | `x`, `y` | `PickupSystem` | `AudioSystem`, `VfxSystem` |
| `level:up` | `level`, `offerA`, `offerB`, `offerC` | `ProgressionSystem` | `GameScene`, `HUDScene`, `AudioSystem` |
| `upgrade:chosen` | `upgradeId` | `UpgradeScene` | `ProgressionSystem` |

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

## Known deviations from the letter of the spec

- `src/__tests__/` holds five test files, not the two named in `docs/KICKSTART.md`.
  `AGENTS.md` says Vitest covers `src/core/` and `src/components/`, and the broader rule was
  chosen deliberately. `Controls.ts` remains untested because it imports Phaser.
- `vite.config.ts` raises `build.chunkSizeWarningLimit`. Phaser is a ~1.3 MB module graph
  with no useful split point, and `AGENTS.md` requires a warning-free build.
