# 4. Features built

Every Stage 1 feature, with the smaller decisions inside it. Read this as "what was built and
what was chosen while building it", not as an API reference.

---

## Movement

**What:** WASD, normalised so diagonals are not faster, clamped to the arena.
**Files:** `entities/Player.ts`, `components/Controls.ts`

### Sub-decisions

**Normalisation is the whole feature.** Holding W and D gives a raw vector of (1, 1), whose
length is √2 ≈ 1.41 — 41% faster than moving straight. Every action game normalises this, and
forgetting to is one of the most common first-game bugs. `Controls.readDirection` returns a
unit vector and the comment says exactly why.

**Four `addKey` calls instead of one `addKeys`.** Phaser's `addKeys()` returns a bare `object`,
unusable under the no-`any` rule without a cast. `addKey()` returns a typed `Key`. Three extra
lines, full type safety — a small example of a project rule improving the code rather than
being routed around.

**The world bounds are the clamp.** `setCollideWorldBounds(true)` and the physics world set to
exactly the arena size. No manual clamping code, because the arena *is* the world.

**Input writes into a scratch vector.** `readDirection(out)` fills a caller-supplied object
rather than returning a new one, so per-frame input allocates nothing.

---

## Auto-fire

**What:** targets the nearest enemy within range; holds fire when none is in range.
**Files:** `systems/CombatSystem.ts`, `components/Weapon.ts`

### Sub-decisions

**`Weapon` knows nothing about projectiles, targets or scenes.** It answers one question — "may
I fire this frame?" — and `CombatSystem` does the rest. That is what keeps it framework-free
and unit tested.

**Squared distances in the target search.** `nearest()` compares squared distances so no square
roots are taken while scanning up to 220 enemies every 0.32 s.

**The cooldown is spent only once a projectile is in hand.** The order is: check readiness,
find a target, acquire a projectile, *then* call `tryFire()`. Spending the cooldown earlier
would let an exhausted pool silently eat shots — the weapon would go on cooldown having fired
nothing.

**The idle cooldown is guarded from going negative:**

```ts
if (this.cooldownRemaining > 0) { this.cooldownRemaining -= dt; }
```

Without the guard, a weapon idling for ten seconds accumulates −10 s of cooldown and then fires
a burst of free shots the moment an enemy appears.

---

## Projectiles

**What:** pooled, fixed speed, expire on a lifetime.
**File:** `entities/Projectile.ts`

### Sub-decisions

**A projectile carries no damage value of its own.** Stage 1 had exactly one weapon, so
`CombatSystem` reads damage off the weapon at the moment of impact. Giving the projectile a
damage field would have been building for a weapon roster that did not exist — the exact
speculative generality the staged plan exists to prevent.

**Lifetime, not off-screen detection.** A projectile ages out after 1.1 s. Simpler than bounds
checks and it doubles as the weapon's effective range limit.

---

## Enemies

**What:** one type, walking in from a ring outside the arena, chasing directly.
**Files:** `entities/Enemy.ts`, `systems/CombatSystem.ts`

### Sub-decisions

**Enemies do not know where the player is.** An enemy holds its own state and nothing else;
`CombatSystem` steers it. This is what keeps entities free of global lookups, and it is the
reason Stage 2 could add enemy types as data rather than as classes.

**They spawn on a ring 48 px outside the world bounds**, so they walk in rather than popping
into existence in front of you.

**Contact damage is on a per-enemy cooldown, not per frame.** An enemy sitting on the player
deals 8 damage every 0.7 s. Without the cooldown it would deal damage 60 times a second and the
game would be unplayable. Each enemy owns its own cooldown, so a crowd deals damage
independently — which is what makes being surrounded lethal.

**Pursuit sets velocity, not position.** Nothing in the codebase moves an object by writing
`x` and `y`; code sets velocity and the physics step integrates it. This is why most systems do
not multiply by `dt` themselves — the engine already did.

---

## Waves

**What:** JSON-driven spawning with per-wave HP and speed multipliers. Holds on the final wave.
**Files:** `data/waves.json`, `systems/SpawnSystem.ts`

### Sub-decisions

**Per-entry timers carry their remainder.**

```ts
this.entryTimers[i] = timer - entry.intervalSeconds;   // not = 0
```

Zeroing would make spawn cadence drift with the frame rate; carrying the remainder keeps a
1.6 s interval meaning 1.6 s regardless of how the frames landed.

**Timer arrays are sized once, to the widest wave**, in the constructor — so advancing a wave
never allocates.

**After the final wave it holds rather than ending the run.** Stage 1 ends on death, not on a
clear condition. Worth knowing when reading the code: there is no win state, by design.

---

## Damage in both directions

**What:** projectiles hurt enemies, contact hurts the player.
**File:** `systems/CombatSystem.ts`

### Sub-decisions

**Both collision handlers guard on `active`:**

```ts
if (this.runEnded || !projectile.active || !enemy.active) return;
```

One physics step can report several pairs involving a sprite that an earlier pair already
released back to its pool. Without the guard you get double damage, or damage to an enemy that
is already dead and reused. This is the single most important idiom to copy from this codebase
if you write pooled collision handling.

**`Health` does not emit events.** It is a dependency-free value object that `Player` and
`Enemy` each construct. `CombatSystem` is already the single place all damage resolves, so it
is the natural place to emit from. Giving `Health` a bus reference would have changed every
construction site and every test to no benefit.

**Death position is captured before release.**

```ts
const deathX = enemy.x;  // read before the pool reuses this sprite
this.enemies.release(enemy);
this.bus.emit('enemy:died', deathX, deathY);
```

Release does not destroy the sprite — it hides it and returns it to the free list, where a
later spawn may move it. Emitting the position after release could report the wrong place.

---

## XP gems

**What:** drop on death, get pulled in within magnet range, increment a counter.
**Files:** `systems/PickupSystem.ts`, `entities/XpGem.ts`

### Sub-decisions

**`PickupSystem` learns about deaths through the bus, not from `CombatSystem` directly.**
Neither system owns the other, so this is a genuine cross-cutting edge — and it is what lets a
second thing that drops on death be added without `CombatSystem` hearing about it.

**`update` takes `_dt` and ignores it.** Gems are pulled by setting a velocity and letting the
physics step integrate it, so this system has nothing of its own to advance by time. The unused
parameter is kept because the `System` interface requires it, and the comment says so rather
than leaving a reader wondering.

---

## HUD

**What:** health bar, wave counter, XP counter, in a parallel scene.
**File:** `scenes/HUDScene.ts`

### Sub-decisions

**It runs in parallel with `GameScene` and holds no reference to it.** Every number arrives as
a bus event. This is invariant 3's showcase.

**It seeds itself with the run's starting values in `create()`** rather than waiting for a first
event, which removes any dependence on whether the HUD boots before or after `GameScene`'s
first update. Scene boot order is not something you want to be quietly relying on.

**The health bar is a `Graphics` object redrawn on change**, not a sprite scaled to a ratio —
simpler, and it makes the background/fill split trivial.

---

## Run flow

**What:** Menu → game → death → summary → restart.
**Files:** `scenes/`

### Sub-decisions

**Six scenes, each with one job.** `BootScene` does nothing yet and exists as the seam where
boot-time configuration will go — a deliberate empty room rather than a missing one.

**`GameOverScene` receives its numbers through scene data, not the bus.** By the time it exists
the bus has been cleared and the run it is reporting on is gone. This is a good example of
choosing the *right* channel rather than the habitual one.

**`CombatSystem` tracks wave and XP off the bus** purely so it can put a complete summary into
`run:ended`. It is the system that ends the run, so it is the system that reports on it.

---

## Content validation

**What:** `waves.json` is zod-validated at boot; malformed content crashes immediately with the
exact failing path.
**File:** `data/schema.ts`

Covered under [stack decisions](02-stack-decisions.md#zod--runtime-validation-of-game-content).
The feature-level point: this is verifiable in ten seconds. Set `"intervalSeconds": -1`, reload,
and the console names `waves[5].spawns[0].intervalSeconds`. `ONBOARDING.md` uses it as an
exercise for exactly that reason.

---

## Restart safety

**What:** two consecutive restarts behave identically to one, verified by listener census.
**File:** `scenes/GameScene.ts`

Covered under [architecture decisions](03-architecture-decisions.md#9-scenes-clean-up-on-shutdown).
The feature-level point: this was *measured*, not assumed, and the measurement is written down
so that a future change to the listener set has a baseline to be compared against.

---

**Next:** [Difficulties and fixes](05-difficulties-and-fixes.md)
