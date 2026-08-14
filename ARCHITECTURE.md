# ARCHITECTURE

## Current stage

**Stage 1 — in progress.** Pass 1 (skeleton) complete; Pass 2 (implementation) not started.

Stage 1 is: player movement, auto-aim weapon firing pooled projectiles, one enemy type with
chase AI, wave-based spawning driven by JSON, collision damage in both directions, XP gems,
an HP bar and wave counter in a parallel HUD scene, and game over with restart.

Everything else — sprites, audio, particles, screen shake, upgrades, enemy variety,
persistence, mobile controls, settings, i18n — is Stage 2 or Stage 3. It is not built, not
stubbed and not prepared for. See `AGENTS.md` for the stage table.

## The shape of a frame

```
GameScene.update(time, delta)
  dt = min(delta / 1000, BALANCE.time.maxDeltaSeconds)   <- the only ms→s conversion
  player.update(dt)                                       <- input becomes velocity
  SpawnSystem.update(dt)                                  <- wave timeline, enemies enter
  CombatSystem.update(dt)                                 <- pursuit, firing, projectile age
  PickupSystem.update(dt)                                 <- gem magnet
  (Phaser then steps the physics world and runs colliders)
```

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
| `PreloadScene` | Loads `waves.json`, validates it, bakes the four rectangle textures. | `MenuScene` |
| `MenuScene` | Title card. Any key or click starts a run. | `GameScene` |
| `GameScene` | Builds the world, owns the pools and systems, runs the frame. | `GameOverScene` |
| `HUDScene` | Runs in parallel with `GameScene`. Draws HP, wave and XP. | stopped by `GameScene` |
| `GameOverScene` | Final stats and restart. | `GameScene` |

`GameScene` launches `HUDScene` in parallel and stops it again when the run ends. `HUDScene`
holds no reference to `GameScene`, to `Player`, or to anything inside the run — every number
it draws arrives as a bus event, and it seeds itself with the run's starting values so it
does not care whether it boots before or after the first frame.

### Shutdown

Every scene registers a `Phaser.Scenes.Events.SHUTDOWN` handler. `GameScene`'s handler:

1. calls `destroy()` on each system, which unsubscribes it from the bus;
2. calls `releaseAll()` on each pool;
3. calls `eventBus.clear()`;
4. stops `HUDScene`.

This is what makes the second restart behave identically to the first. A listener that
survives a shutdown fires twice on the next run, and that class of bug is invisible until
someone restarts twice.

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
| `CombatSystem` | The fight loop: enemy pursuit, weapon cooldown and auto-aim, projectile lifetime, damage in both directions, death. |
| `PickupSystem` | Gems: spawning them on death, pulling them in, converting them to XP. |

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
| `enemy:died` | `x`, `y` | `CombatSystem` | `PickupSystem` |
| `xp:changed` | `total` | `PickupSystem` | `HUDScene`, `CombatSystem` |
| `run:ended` | `waveReached`, `xpTotal` | `CombatSystem` | `GameScene` |

### What does not go through the bus

Physics collision callbacks call `CombatSystem` and `PickupSystem` methods directly. Those
callbacks fire per contact per frame — an event per bullet impact would allocate an argument
array in the hottest path in the game. `GameScene` owns both systems, so the call is a
parent reaching into its child, not the cross-cutting traffic the bus exists for.

`CombatSystem` tracks the current wave and XP total off the bus so it can put a complete run
summary into `run:ended`. It is the system that ends the run, so it is the system that
reports on it.

## Content vs balance

Two files hold numbers, and the split is deliberate:

- **`src/constants/balance.ts`** — base stats and tunables. The grunt's base HP and speed,
  the weapon's damage and cooldown, pool sizes, colours, sizes, the arena dimensions.
- **`src/data/waves.json`** — escalation. Per wave: a duration, and a list of spawn entries
  giving an enemy id, a count, an interval, and `hpScale`/`speedScale` multipliers applied
  against the base stats.

Base stats are balance. Escalation is content. Only content belongs in a data file.

`waves.json` is validated by `src/data/schema.ts` with `.parse()`, never `.safeParse()`, in
`PreloadScene`. Malformed content crashes at boot rather than producing an empty wave 7.

## Which file do I touch?

| I want to… | Touch |
|---|---|
| Add an entity | A new file in `src/entities/`, its stats in `constants/balance.ts`, a pool and group in `GameScene.create()`. |
| Add an enemy type | A new file in `src/entities/`, its base stats in `constants/balance.ts`, its id in `enemyIdSchema`, and an entry in `waves.json`. No scene edits. |
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
