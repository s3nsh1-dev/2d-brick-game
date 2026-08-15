# Pass D — performance, measured

**The most valuable pass in the stage, and it changed no code.**

The brief's rule was absolute: *"Measure first. Record the number in the commit message. Then
optimise. A pass that reports a conclusion without a measurement has failed even if the code is
faster."*

Commit: `perf: measure the budget, and change nothing`.

---

## The baseline

`AGENTS.md` had claimed 60 fps at 200 enemies and 100 projectiles since Stage 1, and **nobody
had verified it since Stage 1**. Stage 2 then added animations, particles, floating text and
audio on top of it, and Stage 3 added an arena, a UI kit and damage tinting.

Production build (`npm run build && npm run preview`), not the dev server:

| | |
|---|---|
| Conditions | `BALANCE.debug.startWave = 8`, **133 s / 7,959 frames**, up to **220 enemies alive** — the pool ceiling |
| Environment | Chrome 151, WebGL2 via ANGLE on AMD Radeon (radeonsi renoir), 32 texture units, 1280×720 at DPR 1 |
| **Frame time** | mean **16.68 ms**, p50 16.70, p95 16.80, p99 17.00, **max 17.60** |
| **Frame rate** | mean **59.9 fps**. No frame ever doubled; the worst missed vsync by 0.9 ms |
| **Draw calls** | **6–10 per frame**, mean 6.4, at 220 sprites |
| **Heap over 133 s** | 79.67 MB → 71.19 MB — it *shrinks* |

The budget is met with room to spare, at ten percent more enemies than the budget names.

### How the numbers were taken

Frame times from `requestAnimationFrame`, heap from `performance.memory`, and draw calls by
**wrapping the live WebGL context** — because Phaser 4's WebGL renderer exposes no draw-call
counter. Only the Canvas renderer has `drawCount`. This is the sort of thing that is worth
recording precisely: the obvious property does not exist, and half an hour disappears
discovering that.

`BALANCE.debug.startWave` exists so this is reproducible. It is inert at its default of 1.

---

## Three optimisations considered, measured, and *not* made

The brief named three suspects in advance and pre-authorised the negative result. All three
were negative.

### No texture atlas

Stage 2 deferred this explicitly — *"sprite-count batching is a Stage 3 problem"* — and the
brief called Pass D the moment it would finally earn its place.

It did not. **220 sprites cost 6–10 draw calls.** The GPU exposes 32 texture units and Phaser 4
binds the game's ~81 tiny baked textures across them, so there is no batch break to fix. An
atlas would have added a build step, a coordinate indirection and a source of bugs, to optimise
something that was never costing anything.

This is the single most useful result in the pass, because "we should probably atlas this" had
been carried since Stage 2 and is now permanently closed.

### No `BitmapText`

`Text` owns a canvas and re-rasterises on `setText`, which is a real cost and a real reason to
prefer `BitmapText` — in general. Here the heap *fell* over 133 seconds and no frame missed
vsync. Pass C's `textsPerFrame: 2` cap already bounds the rasterisation to two per frame, which
is the reason the general problem does not apply to this specific game.

### No allocation hunt

Invariant 6 bans `new` in update paths, but closures, array literals, object literals and
string concatenation all allocate too, and the brief was right to name them. Negative heap
growth over 7,959 frames is the evidence that the existing discipline is holding. There is
nothing to find.

---

## Bundle size

~1.5 MB raw / ~394 kB gzip, effectively all of it Phaser. The brief asked whether Phaser 4
supports a custom build excluding unused subsystems — this game uses no tilemaps, no Matter
physics, no video and no DOM elements.

**It does, and it was still declined.** Phaser ships prebuilt webpack bundles — `dist/phaser.esm.js`
is bundler *output*, not tree-shakeable ES modules — so nothing this project does at build time
can drop the unused subsystems. The one real lever is Phaser's own arcade-only variant, and it
was measured:

```
1344 kB → 1237 kB minified      346 kB → 314 kB gzipped      ~8%
```

The price is aliasing to a UMD bundle whose shipped types still describe the *full* build — the
type surface would promise a Matter physics that is not there. An 8% saving on a static page
that loads once is not worth a lying type definition.

`vite.config.ts`'s raised `chunkSizeWarningLimit` is therefore permanent, and the comment in
that file says so along with the measurement, because `AGENTS.md` requires a warning-free build
and the honest way to get one is to raise the threshold deliberately rather than tolerate the
warning.

---

## What this pass is actually for

Nothing got faster. Four things became true that were not true before:

1. The budget in `AGENTS.md` is a **measurement** with a stated method, conditions and
   environment, not a claim inherited from Stage 1.
2. The atlas question is closed with a number instead of an intuition.
3. `debug.startWave` makes it reproducible by anyone in about two minutes.
4. Invariant 20 exists: *no performance change lands without a before/after number, and a
   recorded negative result is a successful outcome.*

A pass that deletes three future sessions of speculative optimisation work is worth more than a
pass that makes the frame 0.3 ms faster.
