# 4. Pass C — game feel

**Delivered:** knockback on hit and hit-stop on enemy death, both in `CombatSystem`.

**Why it is its own pass:** it is the one place Stage 2 deliberately changes gameplay. Isolating
it is what makes Pass B's "identical timing" claim checkable.

The smallest pass by volume — two tunables, three entity methods, one scene branch — and the
most conceptually interesting, because it is the pass that forced the gameplay/presentation line
to be defined precisely rather than felt.

---

## The dividing line

Screen shake, damage flash, particles and floating text went into `VfxSystem` in Pass B.
Knockback and hit-stop went into `CombatSystem` in Pass C. Every one of those six things is
"juice", and they landed on opposite sides of the architecture.

The test is **not** "does it look like juice". It is:

> **Does deleting it change where anything ends up?**

| Effect | Delete it, and… | Verdict |
|---|---|---|
| Screen shake | every body is in the same place on the same frame | presentation |
| Damage flash | same | presentation |
| Hit sparks | same | presentation |
| Floating numbers | same | presentation |
| **Knockback** | enemies are somewhere else | **gameplay** |
| **Hit-stop** | the whole game runs at a different tempo | **gameplay** |

Hit-stop is the sharper of the two. It *freezes the simulation* — that is a change to timing,
and it could not live in `VfxSystem` without breaking invariant 11 in spirit, because the game
would play at a different tempo depending on whether a "presentation" system was present.

That is the whole reason the invariant is phrased as *deleting both systems leaves a playable,
silent, unadorned game with identical timing*. The words "identical timing" are doing real
work: they are what makes hit-stop's home unambiguous.

---

## Knockback

An enemy that survives a hit is thrown along the vector from the player, and its pursuit is
suspended for the duration.

```ts
if (!enemy.health.isDead) {
  const direction = setLength(scratchA, enemy.x - this.player.x, enemy.y - this.player.y, 1);
  enemy.applyKnockback(direction.x, direction.y);
  return;
}
```

### Decisions

**Direction from positions, not from the projectile's velocity.** The projectile has already
gone back to its pool by this point — it is released before damage is applied, so that a
released sprite cannot be double-processed. Reading its velocity would read a dead object's
stale state.

**The system decides direction; the entity owns speed and duration.** `applyKnockback` takes an
already-normalised direction and applies `BALANCE.combat.knockback.speed` itself. Splitting the
two constants across files would have been worse than either alternative — this keeps both
numbers together in `balance.ts` and leaves the geometry decision in the system, which is where
decisions belong.

**Pursuit must yield to it.** `CombatSystem` steers every enemy every frame, so without a guard
the knockback velocity would be overwritten on the very frame it was applied:

```ts
enemy.tickKnockback(dt);
if (enemy.isKnockedBack) {
  continue;   // its velocity is the knockback, not pursuit
}
```

**Re-applying restarts the clock rather than adding to it.** A stream of hits holds an enemy
off; it does not launch it into orbit.

**Only on survival.** A dying enemy is released immediately, so knocking it back would be work
on an object about to be recycled.

**0.11 s at 240 px/s** — short enough that a swarm still closes in, long enough that a hit reads
as a hit.

---

## Hit-stop

When an enemy dies, the entire simulation stops for 45 ms.

### The interesting problem: who owns the clock

`CombatSystem` owns the death, so it owns the freeze. But `CombatSystem` has **zero runtime
Phaser imports** and must keep it — at the time this was written, the planned Stage 3 would have
moved that file into a Phaser-free package. It cannot pause anything itself.

The resolution splits the decision from the mechanism:

```ts
// CombatSystem — owns the clock, knows nothing about engines
public tickHitStop(dt: number): boolean {
  if (this.hitStopRemaining <= 0) return false;
  this.hitStopRemaining -= dt;
  return true;
}
```

```ts
// GameScene — asks, then translates the answer into an engine call
if (this.combat.tickHitStop(dt)) {
  this.physics.world.pause();
  return;
}
if (this.physics.world.isPaused) {
  this.physics.world.resume();
}
```

This is a scene wiring a system's decision to the engine, which is exactly what scenes are for.
It is deliberately **not** a `System.update` step, because by the time the systems run, the
scene has already had to decide whether the frame happens at all.

### Why pausing the physics world is required

The subtle part, and the thing most likely to be got wrong by someone reimplementing this:
**skipping the systems is not a freeze.**

Phaser steps the physics world *after* `update()` returns. If the scene simply skipped its
systems, every body would keep drifting at its current velocity through the entire pause — a
frozen game in which everything still moves. Pausing the world is what makes the freeze real.

### Coalescing

```ts
this.hitStopRemaining = Math.max(this.hitStopRemaining, BALANCE.combat.hitStopSeconds);
```

`max`, not `+=`. Forty enemies dying in one frame is one freeze of 45 ms, not 1.8 seconds of
slideshow. This is invariant 13's logic — coalesce identical simultaneous effects — applied to
time rather than to sound.

**45 ms** is roughly three frames: long enough to read as impact, short enough that a busy wave
does not stutter.

---

## What was verified

Sampled 240 consecutive frames of a live run:

- **12 frames with `physics.world.isPaused === true`** — hit-stop firing on kills, at about the
  rate kills happen.
- **12 knockback observations, all 12** with the dot product of (enemy − player) and the enemy's
  velocity positive — that is, moving away from the player, which is the property that would
  break silently if the sign were flipped or pursuit won the race.

Both were measured rather than eyeballed, because both are sub-100 ms effects that a human
watching cannot distinguish from a frame drop.

---

## The one-sentence answer the pass had to produce

The brief asked for it explicitly, so here it is:

> Screen shake, flash, particles and floating text stayed in `VfxSystem` because deleting them
> leaves every body in the same place on the same frame; knockback moves bodies and hit-stop
> stops the clock, so both change where things end up and belong with the damage resolution
> that causes them.

---

**Next:** [Pass D — progression](05-pass-d-progression.md)
