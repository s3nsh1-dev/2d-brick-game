# 5. Pass D — progression

**Delivered:** `core/xpCurve.ts`, `core/StatBlock.ts`, `components/Stats.ts`,
`systems/ProgressionSystem.ts`, `data/upgrades.json` with its schema, and `scenes/UpgradeScene.ts`.

**The bar:** levelling up offers three upgrades, taking one visibly changes a stat, and adding a
fourth upgrade is a single `upgrades.json` entry.

---

## Invariant 14, and the refactor it forced

> **Stats are computed, never mutated.** An immutable base plus a list of modifiers, recomputed
> on read. Removing a modifier restores the exact original value.

`StatBlock` holds a `readonly base` and an array of modifiers, and every read recomputes:

```ts
get value(): number {
  let flat = this.base;
  let multiplier = 1;
  for (const modifier of this.modifiers) { /* flats add, multipliers accumulate */ }
  return Math.max(0, flat * multiplier);
}
```

**Why recompute rather than accumulate.** An implementation that applied an upgrade by writing
back into a running total would pass every stacking test and fail the round-trip: remove a
−15% modifier from a float and you do not get your original number back, you get something 15
significant figures away from it. Recomputing from an immutable base makes add-then-remove
*exactly* the identity, and the spec asserts exact equality (`toBe`, not `toBeCloseTo`)
deliberately — `toBeCloseTo` would hide the very failure the test exists to catch.

**Multipliers sum rather than compound.** Two +25% upgrades give +50%, not +56.25%. Summing is
the honest reading of "+25%" on a card and keeps stacking linear enough to reason about while
tuning.

### The refactor it forced

`Weapon` held `readonly damage`, `cooldownSeconds` and `range`. Under invariant 14 that is
untenable — a value copied into a component at construction is stale the moment an upgrade
lands.

So `Weapon` became a **pure fire-rate timer**. It has no stats at all; the cooldown to spend
arrives with the call:

```ts
public tryFire(cooldownSeconds: number): boolean
```

Its spec was rewritten to match, including a new case asserting that a cooldown change between
two shots takes effect on the next one. This is the clearest instance in Stage 2 of an
invariant changing an existing design rather than merely constraining a new one — and it made
`Weapon` smaller and more honest about what it actually does.

Consumers now read through `Stats` every frame rather than caching:

```ts
const speed = this.stats.get(StatId.MOVE_SPEED);          // Player.update
const magnetRadius = this.player.stats.get(StatId.MAGNET_RADIUS);  // PickupSystem.update
```

Recomputing a five-element loop per frame is free; a stale stat is a bug.

---

## The XP curve

`core/xpCurve.ts` — portable, no Phaser, and it takes its numbers as a spec argument the same
way the audio synthesis takes tone specs. That is what keeps it pure and testable.

**Arithmetic, not exponential.** Each level costs a fixed amount more than the last:
`firstLevelCost + costGrowth × (level − 1)`, currently 5 then +3 each time. Gems are worth 1 and
arrive roughly in proportion to how many enemies a wave sends, so a curve that doubled would
stop producing upgrades exactly when the waves start needing them.

**The off-by-one the design is built around:** a run starts at level 1 with 0 XP, so
`totalXpForLevel(1) === 0` and the first threshold is the cost of level *2*. Getting this
backwards is the classic levelling bug, and the spec checks every boundary from both sides:

```ts
expect(levelForXp(threshold - 1, SPEC)).toBe(level - 1);
expect(levelForXp(threshold,     SPEC)).toBe(level);
```

**`levelForXp` walks up rather than inverting the quadratic.** The arithmetic is exact at every
step, where a square root would need rounding decisions right on the level boundaries — which
is precisely where an off-by-one would hide. Levels are small; the loop is not a cost.

---

## Upgrades as content

```json
{
  "id": "quick-trigger", "name": "Quick Trigger",
  "description": "-15% time between shots",
  "stat": "weaponCooldown", "kind": "multiplier", "amount": -0.15,
  "maxStacks": 5, "weight": 3
}
```

Six upgrades ship: damage (×and flat), attack speed, range, move speed, magnet radius.

**`stat` is validated against a shared vocabulary, not typed as a string.** `constants/stats.ts`
exports `StatId` and `STAT_IDS`, and the schema does `z.enum(STAT_IDS)`. An upgrade pointing at
a stat that does not exist fails at boot rather than doing nothing when a player picks it —
which would be a very quiet bug indeed.

That constant lives in `constants/` rather than beside `Stats` because two unrelated folders
need the vocabulary: `components/Stats.ts` builds a block per id, and `data/schema.ts` validates
against the set. A shared `as const` map is the only way both get it without one importing the
other.

**A pleasant consequence of the zod enums:** `upgrade.stat` and `upgrade.kind` are inferred as
exactly the union types `Stats.add` accepts, so applying an upgrade needs **no cast at all**.

**No max-HP upgrade**, because `Health` was declared off-limits for Stage 2. The constraint was
accepted rather than worked around — see [what Stage 2 proved](01-what-stage-2-proved.md).

---

## The level-up flow

Five participants, and no two of them hold a reference to each other:

```
PickupSystem  --xp:changed-->  ProgressionSystem
ProgressionSystem  --level:up(level, a, b, c)-->  GameScene   (pauses, launches the menu)
                                              ->  HUDScene    (updates "LV n")
                                              ->  AudioSystem (plays the level-up sound)
UpgradeScene  --upgrade:chosen(id)-->  ProgressionSystem      (applies the modifier)
UpgradeScene  ->  resumes GameScene, stops itself
```

### Decisions

**The offers are three positional ids, not an array.** Pick-1-of-3 is the design rather than a
parameter, and an array payload would allocate on a bus whose whole point is primitive payloads.

**`ProgressionSystem` does not know `UpgradeScene` exists.** It announces a level and waits for
an id to come back. That is the same shape as every other cross-boundary conversation in the
game, and it means the menu could be replaced entirely without touching the system.

**`UpgradeScene` resolves ids against the registry**, not from a handed-over list — for the same
reason `HUDScene` holds no `Player`.

**`UpgradeScene` resumes `GameScene`, not the other way round.** `GameScene` is paused, so it
cannot act on the event that would tell it to wake up. This is obvious in hindsight and easy to
get wrong.

**`pause()`, never `sleep()`.** A paused scene stops updating but keeps rendering, so the frozen
arena stays visible under the cards. `sleep()` would stop rendering it and leave the menu
floating over black.

**Every `Math.random` stays in `ProgressionSystem`.** Offer generation is weighted selection
without replacement: pick against a running total, remove, repeat. That is one call site, which
keeps the Stage 3 count at six — five in `SpawnSystem` and this one — all inside systems where
a seeding pass can reach them cleanly.

**A guard for a case the current curve cannot produce:** if a single XP gain crossed two
thresholds, the system takes the highest level and offers once. The current numbers make it
impossible; a cheaper curve would not, and the honest reading is that the player *is* that level
now.

---

## The pause concern that turned out to be moot

The brief asked, sensibly, to verify that a `Phaser.Time.TimerEvent` owned by a paused scene
does not fire, and that tweens behave across the pause.

**The game contains neither.** There is not one `TimerEvent` and not one tween in the codebase.
Every clock — spawn intervals, weapon cooldown, contact cooldown, knockback, hit-stop, floating
text lifetime, SFX throttles — is a number decremented by `dt` inside something the scene stops
calling.

So a paused scene cannot have a timer fire behind its back, because there are none to fire.
That is not luck: it follows from the Stage 1 decision to express everything in `dt` rather than
reaching for the engine's scheduler. It is now recorded in `ARCHITECTURE.md`, because a future
change that introduces the first `TimerEvent` should know it is also introducing the first thing
that can outlive a pause.

---

## What was verified

In the running game, driving the real path:

- XP total crossing 5 → **level 2**, `GameScene` paused, `UpgradeScene` active, arena still
  rendering underneath.
- Three cards drawn with number, name and description.
- Pressing `2` (Sharper Rounds, +25% damage) → weapon damage **12 → 15**, cooldown, move speed
  and magnet radius unchanged, game resumed, menu stopped.

Plus 28 new unit tests across `StatBlock` and `xpCurve`, including the exact-round-trip cases
and every level boundary from both sides.

---

**Next:** [Pass E — persistence and flow](06-pass-e-persistence-and-flow.md)
