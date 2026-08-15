# 3. Architecture decisions

Stage 1 was governed by ten invariants, fixed in the original brief before any code existed.
This page takes each as a decision: what it says, why it was worth committing to, what it cost,
and how it held up.

The invariants themselves live in [`../../AGENTS.md`](../../AGENTS.md) and are authoritative
there. This page is the reasoning, not the rule.

> **A note on the shape of the whole thing.** The layering is one sentence: **scenes wire,
> systems think, entities hold state.** Almost every decision below is that sentence applied to
> a specific problem. If you remember one thing, remember it in that form.

---

## The folder map, and why each folder has exactly one job

```
src/core/        portable TypeScript — zero Phaser, zero DOM
src/components/  reusable behaviour an entity owns
src/entities/    sprite + composed components
src/systems/     per-frame logic across many entities
src/scenes/      lifecycle, wiring, transitions
src/constants/   keys, tunables, z-order
src/data/        JSON content + zod schemas
```

Imports flow downward only. A file in the wrong folder is treated as a bug even when it
compiles, because the folder is a claim about what a file is allowed to depend on.

*Reconstructed:* the reason this is stated so strictly up front is that the alternative decays
silently. A `utils/` folder that imports the engine "just this once" is no longer portable, and
nobody notices until the day someone tries to move it. Naming the constraint per folder makes
the violation visible in the diff.

---

## 1. `src/core/**` never imports Phaser

**The decision.** A whole folder of the codebase is plain TypeScript that runs in Node with no
DOM, no canvas, no engine.

**Why it was worth it.** The trickiest logic in a game is rarely the engine glue — it is the
pool, the event dispatch, the vector maths, the curve. Putting that in a folder with no engine
means testing it in milliseconds instead of booting a browser. The Stage 1 suite ran 50 tests
in about a quarter of a second.

**What made it real:** an ESLint `no-restricted-imports` rule scoped to `src/core/**`, plus
Vitest running in `environment: 'node'`. Two independent mechanisms, neither relying on anyone
remembering.

**What it cost.** `core/` cannot name a type from `entities/`, because entities import Phaser
and the dependency would leak through the type graph. This is the direct cause of the event bus
carrying only primitives — see invariant 3.

**How it held up:** completely, and it turned out to be the foundation the entire three-stage
plan rests on. Stage 3's premise — the simulation stops depending on Phaser — is this invariant
taken to its conclusion.

---

## 2. Scenes wire, systems think, entities hold state

**The decision.** A scene's `update()` iterates systems and does nothing else. A system never
touches the renderer. An entity never queries global state.

**Why.** Without a rule like this, a scene becomes the place where everything that does not
obviously belong somewhere else accumulates — and in a game, that is most things. `GameScene`
would become 900 lines and untestable.

**The sub-decisions inside it:**

- **Player movement is ticked by the scene, not by a system.** Stage 1 allowed exactly three
  systems and none was a natural home for input. A fourth system for one entity's input would
  have been building past the stage. This is the one place a scene touches an entity per frame,
  and `ARCHITECTURE.md` names it as a deliberate exception rather than letting it look like an
  accident.
- **Enemy pursuit lives in `CombatSystem`, not a movement system.** Same reasoning: three
  systems, and pursuit belongs with the damage exchange more naturally than with the wave
  timeline.

**Reconstructed cost:** both exceptions are mild architectural debt taken knowingly, and both
are documented at the point where a reader would otherwise be confused. That pattern — take the
shortcut, then write down that you took it — recurs throughout the project.

---

## 3. Cross-cutting communication goes through a typed `EventBus`

**The decision.** Objects that do not own each other never hold references to each other.

The canonical case: **`HUDScene` does not hold a `Player`.** It receives `(current, max)` and
draws a rectangle. You could delete the HUD and the game would run unchanged.

**The typing is the interesting part.** The bus is generic over an event map:

```ts
export interface GameEvents {
  'wave:started': [waveNumber: number];
  'player:health-changed': [current: number, max: number];
  'enemy:died': [x: number, y: number];
  'xp:changed': [total: number];
  'run:ended': [waveReached: number, xpTotal: number];
}
```

Listener storage is a partial mapped type keyed by event name, so each `Set` remembers the
exact signature it holds. The alternative — a `Map` of widened listeners — would have needed a
cast inside `emit` to narrow back. The class as written contains **no type assertions at all**,
which is unusual for an event emitter and was clearly aimed for.

**Payloads are positional primitives, never entities.** Two reasons, and the second is the real
one: decoupling, and the fact that a payload naming an entity would force `core/` to import
from `entities/`, breaking invariant 1 through the type graph. The constraint enforces itself.

**The deliberate exception.** Physics collision callbacks call system methods *directly*:

```ts
this.combat.onProjectileHitEnemy(projectile, enemy);
```

Those fire per contact per frame — the hottest path in the game — and an event per bullet
impact would allocate a rest-argument array every time. `GameScene` owns both systems, so the
call is a parent reaching into its child rather than the cross-cutting traffic the bus exists
for. The exception is documented in both the bus and `ARCHITECTURE.md`.

---

## 4. Composition over inheritance

**The decision.** `Player` and `Enemy` each own a `Health`; they share no base class of ours.
Maximum one level of first-party inheritance anywhere.

**Why.** Entity inheritance hierarchies are the classic way game codebases become unmaintainable
— `Entity → Actor → Character → Enemy → FlyingEnemy` and then you need a flying enemy that does
not take contact damage. Composition sidesteps the whole category.

**What it bought immediately:** `Health` is a dependency-free value object with no Phaser in it,
so it is unit tested with no mocks at all. A `Health` that lived on a base sprite class could
not be.

**How it held up:** Stage 2 added three enemy *types* without adding a single class, because the
things that differ between a grunt and a brute were data in a JSON file rather than overrides in
a subclass. That was possible because there was no hierarchy inviting a subclass in the first
place.

---

## 5. Zero magic numbers outside `constants/balance.ts`

**The decision.** Speeds, HP, damage, cooldowns, spawn rates, radii, **colours and sizes** — all
of it in one `as const` object.

**Why it is stronger than ordinary "no magic numbers" style.** In a game, the numbers *are* the
design. Being able to read the entire feel of the game on one screen, and to rebalance it
without reading any logic, is a genuine capability rather than tidiness. `balance.ts` is close
to a complete specification of what the game is.

**A trap this creates, and it bit:** `BALANCE` is `as const`, so `BALANCE.enemy.baseSpeed` has
the literal type `62`, not `number`. A class field initialised from it infers the literal and
then rejects every other value:

```ts
// Annotated, not inferred: an unannotated field would have type 62 and reject every other speed.
private currentSpeed: number = BALANCE.enemy.baseSpeed;
```

This is recorded in `STATUS.md` as one of the two traps the project fell into.

---

## 6. Everything spawned at runtime is pooled

**The decision.** Projectiles, enemies and gems are constructed **up front**, in the pool's
constructor, and reused forever. No `new` inside any `update()` path.

**Why, in one sentence:** JavaScript's garbage collector runs when it wants to, and a
stop-the-world pause in the middle of a frame is a visible stutter.

**The sub-decision worth noticing:** the pool fills eagerly rather than lazily.

> Every object is constructed up front, in the pool's constructor. That is the point —
> invariant 6 forbids `new` inside any update path, and a pool that allocates lazily on first
> acquire only moves the allocation, it does not remove it.

A lazily-filling pool feels smarter and is wrong here: the first wave-5 spike would allocate
150 sprites mid-frame, which is exactly the stutter the pool exists to prevent.

**The consequences you live with:**

- `acquire()` returns `T | undefined` when exhausted. A designed limit, not an error.
- A released object is hidden and disabled, not destroyed; its fields keep old values until
  something resets them.
- `release()` swap-removes from the active list, so **a loop that releases must walk
  backwards** or it skips elements. There is a unit test pinning this contract.

---

## 7. Content is data

**The decision.** Waves live in `src/data/waves.json`, validated by zod at preload. Not a
hardcoded array.

**The sub-decision that mattered later:** every spawn entry named its enemy id from day one —
`{ "enemy": "grunt", ... }` — even though exactly one enemy type existed and the schema typed it
as `z.literal('grunt')`. A single-member literal looks like pointless ceremony at the time.

It was not. Because the field existed, adding enemy types in Stage 2 was widening a *schema*
rather than changing the *shape* of every wave entry and every consumer. This is the rare case
where a small piece of apparent over-design paid off, and it is worth understanding why it was
acceptable: the field carried information the game genuinely needed (what to spawn), it was not
a hook for an imagined future feature.

**Also decided here:** the split between `balance.ts` and `waves.json`. Base stats are balance;
escalation is content. Only content belongs in a data file. Stage 2 extended this to three files
without changing the principle.

---

## 8. `dt` is seconds, converted exactly once

**The decision.** Phaser hands you milliseconds. `GameScene.update()` converts, and every
signature below it takes seconds.

**Why.** Mixing the two units is the classic source of "why is everything 1000× too fast", and
the bug is hard to see because both are just numbers.

**The sub-decision:** the conversion is also *capped*.

```ts
const dt = Math.min(delta / 1000, BALANCE.time.maxDeltaSeconds); // cap = 1/20s
```

Return to a backgrounded tab after thirty seconds and the next delta is 30,000 ms. Uncapped,
every enemy teleports across the arena and through the player in one step — bodies pass through
each other because collision is tested at discrete positions. The cap trades a little accuracy
for never exploding.

---

## 9. Scenes clean up on `SHUTDOWN`

**The decision.** Every scene registers a `SHUTDOWN` handler that destroys its systems, clears
event listeners and releases pools. **Two consecutive restarts must behave identically to one.**

This is the same bug class as a missing `useEffect` cleanup, and in a game it is worse: the
listener that survives a restart makes the *next* run behave subtly wrong.

**The ordering is load-bearing**, and the comment in `GameScene` says why:

1. `destroy()` each system — which unsubscribes it from the bus
2. `eventBus.clear()`
3. empty the system array
4. `releaseAll()` on each pool
5. stop `HUDScene`

Listener hygiene comes first because anything throwing later would skip it. That is not
hypothetical — step 4 threw during development and took steps 2 and 5 with it, which is
precisely the bug the cleanup existed to prevent. See
[difficulties](05-difficulties-and-fixes.md#phaser-tears-down-its-own-plugins-first).

**The verification method is the notable part.** Rather than eyeballing it, the invariant was
checked by *measurement*: drive `run:ended` through the real path and read
`eventBus.listenerCount` across two consecutive restarts. An identical census each run and
zeros between runs. That number is recorded in `STATUS.md` and is re-checked whenever the
listener set changes.

**Another sub-decision from the same area:** the system array is *emptied* (`length = 0`) rather
than reassigned, because Phaser reuses the scene instance across restarts, so field
initialisers do not run again and a surviving entry would be updated twice.

---

## 10. No `any`, no `@ts-ignore`, no stray non-null assertions

Covered under [stack decisions](02-stack-decisions.md#typescript-59-strict-and-then-some). The
architectural point is that it is stated as an *invariant* rather than a lint preference,
because the two places it comes under real pressure — Phaser's untyped caches and its nullable
`body` — are both places where giving in would hide a genuine runtime hazard.

---

## The definition of done

Not an invariant, but it governed everything:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

…and the game runs with an empty browser console. "It compiles" is not done. "It renders" is
not done.

*Reconstructed:* the reason the console is included is that Phaser reports a great deal at
runtime that the compiler cannot see — a missing texture key, for instance, draws a green
placeholder and logs a warning rather than throwing. A clean console is the only cheap check
that the engine agrees with you.

---

**Next:** [Features built](04-features-built.md)
