# 7. Difficulties and fixes

Everything that went wrong in Stage 2, including two places the brief contradicted itself and
one where its recorded measurement was simply untrue. All of these are recorded in the live
documents too; this page is the narrative version.

---

## The brief contradicted itself about Phaser imports in systems

**The conflict.** Stage 3's readiness gate says:

```bash
grep -rn "from 'phaser'" src/systems/     # must stay empty
```

Invariant 11 says `AudioSystem` and `VfxSystem` must be the **only** code that touches
presentation APIs. And the brief places both of them in `src/systems/`.

Touching the sound manager, the camera and the particle system *means* importing Phaser. The two
rules cannot both hold with both systems in that folder.

**The resolution.** The presentation systems win, because nothing else may hold that dependency
— that is the entire point of invariant 11. The gate's *intent* was that the gameplay systems
could move to a Phaser-free package, and presentation code is view code by definition and would
stay behind. So the check was narrowed to carry the intent:

```bash
grep -rn "from 'phaser'" src/systems/ | grep -v "AudioSystem\|VfxSystem"   # must stay empty
```

**Why it was raised rather than absorbed.** A future session running the original grep would
find two hits, conclude the invariant had been broken, and either "fix" it by moving working
code or lose confidence in the whole gate. The correction is recorded in the brief itself, at
the item it corrects.

---

## The brief's difficulty measurement was wrong

**The claim.** Stage 2's brief and `STATUS.md` both stated that a stationary player "survived
past wave 5 at full health", and built the mandatory balance fix on that premise.

**What measurement showed.** A stationary player died in **wave 4**, having already lost 40 HP
during wave 3. This was found twice independently — in a Node model of the frame loop, and then
in the real browser.

**Why it mattered less than it might have.** The conclusion still held: a five-wave table that
plateaus is not a difficulty curve, whether the player dies in wave 4 or survives forever. The
fix went ahead as specified.

**Why it was still worth correcting.** A brief that mis-states a measurement teaches the next
reader to trust unverified numbers. The correction sits in §3 of the brief with the old claim
left visible beneath it, so the correction has something to point at.

**The lesson:** a number in a status document is a claim, not a measurement, until someone
re-derives it.

---

## The instrumentation lied, twice, in the same way

This one cost the most time and is the most transferable.

**First symptom.** Checking the listener census in the browser gave results **exactly double**
the documented values — the unmistakable signature of a restart leak, the precise bug invariant
9 exists to prevent.

**The cause.** Not a leak. The measurement created one:

```js
const m = await import('/src/main.ts');   // ← a SECOND Phaser.Game
```

The page's own entry is served by Vite as `/src/main.ts?t=1786710424824`. Importing
`/src/main.ts` without that query is a **different module URL**, so the module graph instantiates
a second copy of `main.ts` — and a second `new Phaser.Game(...)`. Both games' scenes then
subscribe to the *same* `EventBus`, because that module resolved to one shared URL. Two games,
one bus, doubled census.

Confirmed by counting canvases: `document.querySelectorAll('canvas').length === 2`.

**Second symptom, later.** A bus `emit` appeared to do nothing at all, and `xp:changed` reported
**zero** listeners while the game was plainly running. Same cause one level deeper: this time the
*bus* was the duplicated module, so the listeners were on a copy nobody was emitting to.

**The fix.** Reach the running instances through objects that already hold them, never through a
fresh import:

```js
const src = document.querySelector('script[type=module][src*="main"]').src;  // exact URL
const m = await import(src);
const bus = gs.systems.find((s) => s.constructor.name === 'ProgressionSystem').bus;
```

**The lesson.** When you instrument a running app from devtools, a module you import is not
necessarily the module it is running. Under a dev server that fingerprints URLs, it usually is
not. Reach for a live object, not a fresh import — and if a measurement shows a suspiciously
round anomaly (exactly double, exactly zero), suspect the measurement before the code.

---

## The partial work did not compile

**What was found.** Stage 2 Pass B existed as partially-completed work in the tree: constants,
four bus events, and five files — but no `VfxSystem`, nothing wired up, and four files still
importing a `TextureKey` that had been renamed to `StaticTextureKey`. `npm run typecheck`
reported four errors.

**How it was handled.** The existing work was read and built on rather than replaced — it was
good work, and rewriting it would have thrown away the audio synthesis and the animation key
scheme for no reason. The compile errors were the loose ends of a rename, and finishing the
rename was a five-minute job.

**The lesson.** Establish the baseline before you build on it. The brief's own precondition
says to verify all four checks before starting and to stop if any fail; running them first is
what turned "mysteriously broken" into "four known loose ends".

---

## A test that was wrong about the thing it tested

**The failure.** A spec asserting that a swept audio tone has no discontinuity failed:
`expected 0.89 to be less than 0.5`.

**The cause was the test, not the code.** At an 8 kHz sample rate, a sine sweeping to 1200 Hz
moves 0.15 of a cycle between consecutive samples, so a step of ~0.9 is *correct* — that is
coarse sampling, not a discontinuity. The property being asserted did not exist.

Worse, the comment in the source claimed the naive `frequency × time` formulation is
"discontinuous at every sample". It is not: it is perfectly smooth. Its actual flaw is that it
sweeps at **twice** the requested rate, because the instantaneous frequency of
`(f₀ + (f₁−f₀)t)·t` is its derivative rather than the bracket.

**The fix.** Replace the assertion with one that is true and that actually discriminates: count
zero crossings in the last tenth of a second of a 200→800 Hz sweep. The correct implementation
gives ~148 (the window averages 740 Hz); the naive one would give ~280. The bound is tight
enough to catch the bug and correct enough to pass.

And the misleading comment in `audioSynth.ts` was corrected, since it was justifying the code
the test now pins.

**The lesson.** When a test fails, the first question is whether the property is real. A test
asserting a false property is worse than no test — it will be "fixed" by loosening the bound
until it passes, and then it guards nothing.

---

## zod's `.nonempty()` does not narrow the type

**The problem.** `GameScene` needs *some* valid texture for pooled enemies at construction, and
the natural source is the first enemy definition. Under `noUncheckedIndexedAccess`,
`enemies[0]` is `EnemyDefinition | undefined`, forcing a guard against a case the schema has
already excluded.

`z.array(x).nonempty()` rejects an empty list at runtime but — in zod 4 — does not infer
`[T, ...T[]]`.

**The fix**, found by probing the actual types rather than assuming:

```ts
enemies: z.tuple([enemyDefinitionSchema], enemyDefinitionSchema),
```

A tuple with a rest element. Same runtime guarantee, and TypeScript infers `[T, ...T[]]`, so the
first element is non-optional and no unreachable branch is needed.

**The lesson.** When a runtime validator and the type system disagree about a guarantee, the
fix is usually a different spelling of the same schema — not a cast, and not a defensive branch
for an impossible case.

---

## An exported type that had quietly become a lie

**What.** `EnemyId` was exported from `data/schema.ts`. Under Stage 1 it was a real literal type
(`'grunt'`). After the schema became a runtime factory, the union is built from values that only
exist at runtime, so the inferred type collapsed to `string`.

**The fix.** Delete it. Nothing imported it, and an exported type named `EnemyId` that is
structurally `string` promises a guarantee the compiler is not making.

**The lesson.** A type alias that no longer narrows anything is worse than no alias, because it
reads like a constraint. Deleting it is not a loss of type safety — the safety had already gone;
only the appearance of it remained.

---

## `setTexture` does not resize the physics body

**The problem.** Pooled enemies are reused across types. A brute (30 px) released and reacquired
as a swarmer (12 px) would keep the brute's hitbox — hitting the player from 9 px further away
than it appears to.

**The fix.** `spawn` sets the body size explicitly every time:

```ts
this.setBodySize(definition.size, definition.size);
```

`setTexture` updates the sprite's display size but never the Arcade body. (In v4 `setSize` is
deprecated in favour of `setBodySize` — checked in the shipped types rather than recalled.)

**The lesson.** Sprite and body are two different things with two different sizes. Anything that
changes one should be assumed not to change the other.

---

## Skipping the systems is not a freeze

Covered in [Pass C](04-pass-c-game-feel.md#why-pausing-the-physics-world-is-required), and
repeated here because it is the single easiest thing to get wrong when implementing hit-stop:
Phaser steps the physics world *after* `update()` returns, so a scene that merely skips its
systems produces a "frozen" game in which every body keeps drifting. The world has to be paused
too.

---

## The recurring shape

Five of the nine items above are the same story: **something asserted was not something
measured.** A brief's claim about survival, a comment's claim about discontinuity, a test's
claim about smoothness, a type's claim about narrowing, a census that looked like a leak.

The habit that caught all five was cheap: before building on a claim, re-derive it — and prefer
a measurement over a reading whenever the two are equally easy.

---

**Back to:** [the folder index](README.md) · **Forward to:** [version 3](../version3/README.md)
