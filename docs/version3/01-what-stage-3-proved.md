# What Stage 3 proved

Stage 1 proved the architecture could be built. Stage 2 proved it survived content. Stage 3 had
to prove something harder to state and easier to fail: **that a codebase built under strict
invariants can be made to look good without any of them bending.**

That is the real question a polish stage asks. Visual work is where discipline usually dies —
a colour typed into a scene because it is faster, a tween reaching into a system, a scene
holding a reference to the player because the HUD needs a number. Stage 3 is 2,000 lines of
presentation code and the invariant count went *up*.

---

## The one decision that shaped everything

**Stage 3 changes no gameplay outcome.** That is invariant 16, and it is the whole discipline
of the stage compressed into one sentence: *does this change where an entity ends up, how much
damage it takes, or when a wave starts?*

It sounds obvious. It is not, because almost every good idea in a polish stage sits right on
the line:

| Idea | Side of the line | Why |
|---|---|---|
| Tint an enemy as it loses health | presentation | The enemy behaves identically. The player can now see what was always true |
| Make a nearly-dead enemy slower | **gameplay** | Changes where an entity ends up |
| Cap particle bursts at six a frame | presentation | The events still fire; only the drawing is capped |
| Cap *damage events* at six a frame | **gameplay** | Changes how much damage things take |
| Fade between scenes | presentation | …unless the fade eats reaction time on the first frame of a wave, which is why they are 200 ms |
| Add a reduced-motion toggle that disables hit-stop | **gameplay, deliberately** | Hit-stop is 45 ms of frozen simulation. Removing it changes timing — which is exactly why it must default to *on*, so the toggle can only ever remove an effect and never confer an advantage |

The last row is the interesting one. Pass E genuinely crosses the line, the brief said it would,
and the resolution was not "don't do it" but "make the direction of the change safe."

---

## The pass order, and why it is not the brief's order

The brief specified six passes, A–F, in that order. They shipped in the order **A, B, C, G, D,
E, F**, and both deviations were deliberate.

**G is not in the brief at all.** After playing the Pass C build, the project's owner asked for
five more waves, a victory condition, a health pickup, and a fix for the level display. Those
are gameplay — the exact thing invariant 16 forbids. The resolution was not to refuse and not
to blend it in, but to **quarantine it**: a separate pass, a separate commit, placed *after* the
polish passes, so that `git diff` from the Stage 2 tag still proves the polish passes changed
no gameplay. An owner changing scope is a decision. An agent quietly widening it is the failure
this project exists to teach.

**D moved after G** because a performance measurement taken before a content change measures
the wrong build. Waves 11–15 push more enemies than wave 10 ever did; measuring the budget
before they existed would have produced a number that was obsolete the moment they landed.

Everything else ran in brief order, and the order mattered:

- **A before B**, because a UI kit with no palette to reference is a kit that bakes in whatever
  colours the first scene happened to use.
- **B before C**, because "readable at 200 enemies" is partly a HUD question, and the HUD had to
  exist in its final form first.
- **C before D**, because Pass C is the one that adds per-frame work, and it is the pass most
  likely to be *why* a budget is missed.
- **E after D**, because reduced motion damps particle counts, and damping something you have
  not measured is guessing.
- **F last**, because shipping is the only pass that cannot be redone cheaply.

---

## What the stage cost, honestly

**One new folder that the brief predicted** (`src/ui/`) and **one it did not** (`src/platform/`).
The second exists because `core/` may name neither `window` nor Phaser, so the `localStorage`
adapter and the live settings singleton had nowhere legal to live. Importing them from another
scene would have been a coupling with no name. The directory map gained a row rather than an
existing folder quietly gaining a second job.

**Two hundred lines added to `balance.ts`**, almost all palette and UI geometry. This is the
invariant working as designed rather than a smell: every one of those numbers would otherwise
be typed into a scene.

**One accepted deviation from the brief's definition of done.** §7 asks for a deployed URL;
§6 of the same document, edited by the owner partway through, says to prepare for deployment
without deploying. The later instruction won and the gap is recorded rather than papered over —
[`../STATUS.md`](../STATUS.md) §2, issue 3.

---

## What did not happen, and is worth noticing

**No invariant was broken to make the game look good.** Not one hex literal outside the palette,
not one `this.add.text()` in a scene, not one gameplay call into a presentation API. The
closest call was the HUD, which needed three facts it did not have — the wave count, the live
level, and the upgrade tally — and got all three as bus events rather than a reference into the
run. Invariant 3 cost about fifteen lines and bought a HUD that still cannot break the game.

**No new dependency.** A UI kit, a settings system, transitions and an accessibility mode, all
on Phaser and 500 lines.

**No speculative generality.** The kit has six widgets because nine scenes needed six widgets.
There is no `Theme` interface, no widget with zero callers, and no hook for a feature that does
not exist. The one place where generality would have been justified — a second palette — was
built in Pass E when there was a second palette, not in Pass A when there was talk of one.
