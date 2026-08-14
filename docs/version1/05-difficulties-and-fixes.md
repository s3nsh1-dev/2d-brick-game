# 5. Difficulties and fixes

The problems that actually cost time in Stage 1, what caused them, and how each was resolved.
Two of these are recorded in `STATUS.md` as traps the project fell into; the rest are
reconstructed from the code's own defensive comments, which are reliable evidence — nobody
writes a four-line comment explaining a guard they never needed.

---

## Phaser tears down its own plugins first

**The bug.** `GameScene`'s `SHUTDOWN` handler released the object pools. Releasing a pooled
sprite calls `disableBody()`. That threw, and because it threw *mid-handler*, it skipped the
rest of the cleanup — including `eventBus.clear()` and stopping the HUD.

So the failure was recursive: **the teardown crashed in a way that skipped the teardown**, and
the symptom was a bus listener surviving into the next run, which is exactly the bug the
handler existed to prevent.

**The cause.** By the time a scene's `SHUTDOWN` fires, Phaser has already torn down its own
plugins. The Arcade Physics plugin has released every body, so `sprite.body` is `undefined` and
`disableBody()` dereferences it.

**The fix**, in every entity's `despawn()`:

```ts
if (!this.body) {
  return;   // the engine is destroying them anyway
}
this.disableBody(true, true);
```

**The second fix, which matters more:** the shutdown handler was reordered so listener hygiene
happens *first* — destroy systems, clear the bus, then empty the array, then release pools, then
stop the HUD. Anything that throws later can no longer take the important part with it.

**The lesson.** Phaser's types have always declared `body` as nullable. The guard is honouring
the type, not defending against a phantom. When an engine's types say something can be
undefined during teardown, believe them.

---

## `as const` produces literal types

**The bug.** A class field initialised from the balance object refused every assignment:

```ts
private currentSpeed = BALANCE.enemy.baseSpeed;   // inferred type: 62
// ...later
this.currentSpeed = 93;   // Type '93' is not assignable to type '62'
```

**The cause.** `BALANCE` is declared `as const`, which is what makes it safe and
autocomplete-friendly — every value is its own literal type. An unannotated field initialised
from it inherits the literal rather than `number`.

**The fix:** annotate explicitly.

```ts
// Annotated, not inferred: `BALANCE` is `as const`, so the initialiser's type is the
// literal 62 and an unannotated field would reject every other speed.
private currentSpeed: number = BALANCE.enemy.baseSpeed;
```

**The lesson.** `as const` is a good default for a constants file and it changes inference
everywhere those constants are used. Expect to annotate any mutable field seeded from one.

---

## Phaser 4 is not Phaser 3, and the internet thinks it is

**The difficulty.** This is not a single bug but a constant background hazard. Phaser 3 ran to
3.90 over many years; v4 is a rewrite. Every tutorial, most StackOverflow answers, and the bulk
of any AI model's training data describe v3.

Concretely, in this project:

- `import Phaser from 'phaser'` fails — the default export was removed.
- `Create.GenerateTexture` and `TextureManager.generate` no longer exist.
- The v3 WebGL pipeline system is gone entirely.
- `Geom.Point` was replaced by `Vector2`; `Math.TAU` changed meaning.

**The fix — a process rather than a patch.** The package ships
`node_modules/phaser/skills/`: 28 subsystem documents written for exactly this problem, plus
`node_modules/phaser/types/` as ground truth. The project rule became: read the skill for the
subsystem *before* writing against it, and when a skill and your memory disagree, the types
win.

This sounds bureaucratic and repeatedly paid for itself. The art pipeline exists at all because
checking revealed that `Graphics#generateTexture` survived the removal of the other two
texture-generation APIs.

**The lesson.** When a library has had a major rewrite, your recall is a liability rather than
an asset, and "let me check the types first" is faster than debugging a confident wrong guess.

---

## Releasing from a pool while iterating it

**The difficulty.** `ObjectPool.release()` swap-removes: it pops the tail and drops it into the
hole. That is O(1) instead of O(n), and it means **the array is reordered under any loop that
is iterating it.**

A forward loop that releases will skip the element swapped into the current index.

**The fix.** Every loop that can release walks backwards, and says so:

```ts
// Backwards, because `release` swap-removes from this same array.
for (let i = projectiles.length - 1; i >= 0; i -= 1) { ... }
```

**And it is pinned by a test**, so the contract cannot be broken silently by a future refactor.

**The lesson.** Any data structure with O(1) removal reorders on removal. Either iterate
backwards, iterate a copy (which allocates — not acceptable per frame), or accept skipping.
Choose deliberately and write down which one you chose.

---

## Double damage from one physics step

**The difficulty.** Arcade Physics can report several overlapping pairs in a single step. If a
projectile hits two enemies in the same step, or an enemy is hit twice, the naive handler
applies damage to a sprite that has already been released and possibly already reused.

The symptoms are nasty because they are intermittent: enemies dying to fewer shots than they
should, or a freshly-spawned enemy appearing pre-damaged.

**The fix.** Both guards, in both collision handlers:

```ts
if (this.runEnded || !projectile.active || !enemy.active) return;
```

**The lesson.** With pooling, "is this object still the object I think it is?" becomes a real
question. Checking `active` at the top of every collision handler is the cheap answer.

---

## The bundle-size warning that cannot be fixed

**The difficulty.** The definition of done requires a build with zero warnings. Phaser is a
~1.3 MB module graph, so every build exceeded Vite's 500 kB chunk-size warning threshold.

Manual chunking does not help — the game imports the engine, and the engine has no meaningful
split point.

**The fix.** Raise the threshold deliberately, with a comment stating that the alternative was
considered:

```ts
// Phaser is a single ~1.3MB module graph with no meaningful split point...
// AGENTS.md requires a warning-free build, so the threshold is raised deliberately
// rather than the warning being tolerated.
chunkSizeWarningLimit: 2000,
```

**The lesson.** A permanent warning trains everyone to ignore warnings. Either fix it, or
silence it *explicitly and with a reason*. The one thing not to do is leave it there.

---

## Vite reloads the whole page on every change

**The difficulty.** This reads as a bug if you come from web development, where HMR swapping a
module and preserving state is the expected experience.

**Why it is correct.** A Phaser game holds its world, physics bodies, texture cache, animation
registry and scene instances in memory. Hot-swapping a class definition would leave a running
game whose live objects were constructed by the previous version of that class. The result is
not "mostly works" — it is subtly, unreproducibly broken.

**The decision.** Do not attempt to add HMR handling. It is written into `AGENTS.md` as a rule
so nobody tries to be helpful later.

**The lesson.** Full reload plus a one-second boot is a perfectly good iteration loop for a
game, and the state you would have preserved is state you usually want reset anyway.

---

## Scene instances are reused across restarts

**The difficulty.** Phaser constructs each scene object **once** for the lifetime of the game
and reuses it on every restart. Field initialisers and constructor bodies run a single time.
Anything set up there survives into the next run carrying the previous run's values.

**The fix.** Set up per-run state in `create()`, and in teardown *empty* collections rather than
reassigning them:

```ts
// Emptied rather than reassigned: Phaser reuses the scene instance across restarts, so
// field initialisers do not run again and a surviving entry would be updated twice.
this.systems.length = 0;
```

**The lesson.** In a scene, the constructor is "once, ever" and `create()` is "once per run".
Putting run state in the constructor is the game equivalent of a module-level mutable singleton.

---

## The one that was not found until Stage 2

Recorded here because it belongs to Stage 1's code, and because "we shipped it green and it was
still wrong" is the most useful kind of lesson.

**Stage 1's difficulty curve had no fail state.** The wave table stopped at five waves and then
plateaued, and the weapon cleared the swarm at roughly the rate it arrived. `STATUS.md` recorded
the belief that a stationary player "survived past wave 5 at full health".

Two things were wrong. The plateau was real and mattered — a five-wave table that holds forever
is not a difficulty curve. But the *measurement* was also wrong: when Stage 2 actually measured
it, a stationary player died in **wave 4**, having already lost 40 HP in wave 3.

**The lesson, and it is the biggest one on this page:** all four checks passing and the console
being empty tells you the code is correct. It tells you nothing about whether the game is any
good, and nothing about whether the numbers in your head match the numbers in the running
program. Balance claims need measuring, and a claim written into a status document is not a
measurement.

Stage 2 fixed both the curve and the claim. See
[version 2, Pass A](../version2/02-pass-a-content-and-curve.md).

---

**Next:** [Lessons for a new 2D web dev](06-lessons-for-new-game-devs.md)
