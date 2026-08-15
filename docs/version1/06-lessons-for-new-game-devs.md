# 6. Lessons for a new 2D web dev

> **Read [`../ONBOARDING.md`](../ONBOARDING.md) first if you have never built a game.** It
> teaches the concepts — the loop, scenes, sprites, bodies, pools, delta time — and this page
> does not repeat them. What follows is the practical residue of building Stage 1: the things
> that were learned by getting them wrong, in the order you are likely to hit them.

---

## 1. The mental model that has to change first

**A web app reacts. A game ticks.**

Nothing in the app is waiting for an event. A function runs sixty times a second forever and
must finish in under 16.7 ms. Everything else on this page follows from that one fact:

- There is no "nothing happened" — enemies are always moving.
- Nothing is watching your state. If you do not move it, it does not move.
- Allocation is not free, because the collector will eventually stop the world to clean up.
- "Correct but slow" is a bug, not a trade-off, once it exceeds the frame budget.

## 2. Get delta time right on day one

Frames are not evenly spaced. Express every speed **per second** and multiply by the seconds
that actually elapsed.

Three rules that prevent nearly all `dt` bugs:

1. **Convert milliseconds to seconds exactly once**, at the top of the frame, and make every
   signature below it take seconds. Mixing units is the classic "everything is 1000× too fast".
2. **Cap it.** A backgrounded tab returns with a 30,000 ms delta and every body teleports
   through every other body. `Math.min(delta / 1000, 1/20)` costs nothing.
3. **Know when you do *not* need it.** If you set a velocity and the engine integrates it, the
   engine already applied `dt`. Multiplying again is a subtle, hard-to-see bug.

## 3. Set velocity, not position

Writing `sprite.x += 5` fights the physics engine, breaks collision resolution, and makes
movement frame-rate dependent. Set velocity and let the step move the body.

The corollary: **collision callbacks run after your update, not during it.** By the time a hit
handler fires, every system has finished and the world has been stepped. Anything you assumed
about ordering inside your update no longer holds there.

## 4. Pool everything you spawn, and fill the pool eagerly

If a thing can appear more than a few times a second, build all of them up front and reuse them.

The part beginners get wrong: **a lazily-filling pool is not a pool.** Allocating on first
acquire just moves the allocation to the worst possible moment — the first big wave. Build them
all in the constructor, accept the memory, and never allocate again.

Then internalise the three consequences:

- `acquire()` can return nothing when exhausted. Handle it; it is a designed limit.
- A released object is hidden, not destroyed. Its fields keep old values until reset.
- Removal reorders the active list, so **loops that release must walk backwards**.

## 5. `active` guards on every collision handler

With pooling, a sprite can be released and reused between two callbacks in the same physics
step. Every handler starts with a guard:

```ts
if (!projectile.active || !enemy.active) return;
```

Skipping this produces intermittent double damage and enemies that spawn pre-damaged — bugs
that are miserable to reproduce because they depend on collision ordering.

## 6. Clean up on teardown, and test by restarting twice

This is the `useEffect` cleanup bug wearing a different hat. Every listener subscribed in
`create()` must be unsubscribed on `SHUTDOWN`, or it survives into the next run and fires twice.

Two practical notes:

- **One restart hides the bug; two reveal it.** Make "restart twice" your manual test.
- **Order your teardown so the important part cannot be skipped.** Unsubscribe first, then do
  the things that might throw. Stage 1 learned this the hard way — see
  [difficulties](05-difficulties-and-fixes.md#phaser-tears-down-its-own-plugins-first).

Better still, **measure it**: count listeners across two restarts and assert the census is
identical and zero in between. That turns a vague worry into a number.

## 7. The engine tears itself down before your teardown runs

By the time your `SHUTDOWN` handler executes, the physics plugin may already have released
every body. Anything in teardown that touches `sprite.body` needs a guard.

Generalised: **during teardown, assume the engine has already destroyed more than you expect.**
Check nullable things the types say are nullable, rather than assuming they are populated
because they were populated a millisecond ago.

## 8. Scene constructors run once, ever

Phaser builds each scene object once and reuses it across every restart. Constructor bodies and
field initialisers run a single time in the process's life.

Per-run state belongs in `create()`. Collections that must survive the instance should be
emptied (`arr.length = 0`), not reassigned.

## 9. Put every number in one file

Speeds, HP, damage, cooldowns, radii, colours, sizes, pool capacities. One `as const` object.

Two payoffs that are bigger than they sound: you can read the entire design on one screen, and
you can rebalance without reading any logic. The whole of Stage 2's difficulty work was
possible because the game's difficulty was already expressed as numbers rather than scattered
through the code.

The cost to expect: `as const` gives you literal types, so mutable fields seeded from it need
explicit annotations.

## 10. Make content data, and validate it loudly

Waves, enemy definitions, upgrades — JSON with a schema, parsed at boot with the *throwing*
parser, not the safe one.

The rule of thumb: **fail at boot, in front of the developer, rather than at wave 7 in front of
a player.** A crash naming `waves[5].spawns[0].intervalSeconds` costs ten seconds to fix. A
silently empty wave costs an afternoon.

Note the boundary, though: content you author gets `.parse()`; input you did not write — a
save file, a URL parameter — gets `.safeParse()` and a fallback. Stage 2's `SaveStore` is the
one place in this codebase that uses the safe parser, and the reason is exactly that the input
is not ours.

## 11. Do not build ahead

This project's organising discipline, and it is worth adopting even without a staged brief.

Concretely: no `upgrades?: Upgrade[]` field "so the next version is easier", no
`// TODO: particles here`, no generalising a class to handle a case that does not exist. Every
such hook is a guess about a future you have not designed yet, and guesses age badly.

The distinction that makes this usable — and it is genuinely subtle — is between a field that
carries information the game *needs today* and a hook for a feature that does not exist.
Stage 1's `"enemy": "grunt"` in every wave entry looked like over-design with one enemy type,
but it answered a real question the spawner had to ask ("what should I spawn?"). It paid off
enormously in Stage 2. A `damage` field on the projectile would have been the other kind, and
it was correctly left out.

## 12. Verify by running, not by compiling

Four green checks and an empty console mean the code is correct. They say nothing about whether
the game is fun, fair, or even survivable.

Stage 1 shipped entirely green with a difficulty curve that had no fail state, and with a
written claim about survival that turned out to be wrong when someone finally measured it. If
you assert something about how your game *plays*, measure it — in the running game, with real
numbers — or write it down as a guess.

## 13. Check the engine's own docs before writing against a subsystem

If your engine had a major version rewrite, your memory and the internet are both describing
the old one. Phaser ships subsystem documentation and full type declarations inside the
package. Reading the relevant one takes two minutes; debugging a confidently-wrong API call
takes considerably longer.

"Let me check the types first" is not slow. It is the fast path.

---

## The shortest possible version

1. Convert `dt` once, cap it, and never mix units.
2. Set velocity; let the engine integrate.
3. Pool everything, fill eagerly, iterate backwards when releasing.
4. Guard collision handlers on `active`.
5. Unsubscribe on teardown; test by restarting twice.
6. All numbers in one file; all content in JSON with a schema.
7. Build only what this version needs.
8. Measure claims about how it plays.

---

**Back to:** [the folder index](README.md) · **Forward to:** [version 2](../version2/README.md)
