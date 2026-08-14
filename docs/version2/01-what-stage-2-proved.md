# 1. What Stage 2 proved

## The thesis

Stage 1 proved the architecture *existed*. Stage 2 was the test of whether it survived contact
with content: art, sound, effects, enemy variety and progression — the things that in most
codebases arrive as a flood of special cases and quietly dissolve the structure.

The question being asked was narrow and answerable: **when you add the stuff a game actually
needs, do the boundaries drawn in Stage 1 hold, or do they turn out to have been decoration?**

The short answer: they held, with three exceptions, all documented and two of them corrections
to the *brief* rather than to the code. See [difficulties](07-difficulties-and-fixes.md).

## Additive by design, with one deliberate exception

Stage 2 was specified as additive — it adds on top of the existing structure and changes none
of it. Any addition that required editing a Stage 1 scene was to be reported as a *finding*
rather than quietly absorbed.

The one place gameplay deliberately changes is Pass C (knockback and hit-stop), and that pass
exists separately **precisely so the change is visible**. That is a technique worth stealing:
when you know one part of a piece of work will violate the rule the rest follows, isolate it
into its own unit so the violation cannot hide inside unrelated changes.

## Why five passes, split where they were

| Pass | Scope | Why it is its own pass |
|---|---|---|
| **A** | Enemy definitions + difficulty curve | Content and balance, no presentation. The architecture test. |
| **B** | Animation, audio, particles, floating text, shake, flash | Presentation only — and the claim "gameplay is unchanged" is *checkable* only if nothing gameplay-affecting rides along. |
| **C** | Knockback, hit-stop | The one pass that changes gameplay. Isolated so the change is visible. |
| **D** | XP curve, stats, upgrades, upgrade scene | Depends on A: tuning progression against a flat curve produces numbers that mean nothing. |
| **E** | Save, pause, docs | Closes the stage; the save format depends on knowing what a run produces. |

The dependency worth understanding is **A before D**. Pass D ships an XP curve and upgrade
pacing, and both are *answers to a difficulty ramp*. Stage 1 had no ramp to answer. Tuning
upgrades against a flat curve gives you numbers that feel arbitrary, and you find out only
after building the whole progression system on top of them.

The second is **B before C**. Pass B's definition of done is "deleting `AudioSystem` and
`VfxSystem` leaves a fully playable, silent, unadorned game with identical timing." That claim
is only checkable because knockback and hit-stop — the two things that *do* change timing and
positions — were held back to C.

## The five invariants Stage 2 added

Numbered 11–15 in [`../../AGENTS.md`](../../AGENTS.md). Each is a rule the passes were built to
satisfy, not a description written afterwards:

**11. Presentation is event-driven and one-directional.** No gameplay code calls
`sound.play()`, `camera.shake()` or spawns a particle. Gameplay emits a typed event;
`AudioSystem` and `VfxSystem` are the only subscribers that touch presentation APIs.

**12. Emitters and sounds are created once, at system init.** Never per-hit, never per-frame.

**13. Identical SFX inside a short window are coalesced.** Forty enemies dying in one frame
plays one death sound.

**14. Stats are computed, never mutated.** An immutable base plus modifiers, recomputed on read.

**15. Save data carries a schema version.** Validated on read, migrated when possible, discarded
when not, and never able to crash the boot sequence.

Invariant 11 is the one that shaped the most code, and it earns its place by being *testable*:
delete two lines from `GameScene` and the game must still be playable. A rule you can check by
deletion is worth more than a rule you can only check by reading.

## What Stage 2 deliberately did not touch

Held for the Stage 3 that was planned at the time, and not stubbed or prepared for: npm
workspaces, moving game rules out of Phaser, replacing Arcade Physics, seeded RNG, fixed
timestep, replay recording, ECS, web workers, pathfinding, arena obstacles, a level editor, any
backend.

> **Postscript.** That Stage 3 was subsequently cancelled — the project ships as a game rather
> than as an architecture proof, and Stage 3 is now refinement and deployment. So most of the
> list above is not deferred; it is out, permanently. `docs/STAGE_3_instructions.md` §2 records
> the decision and its cost. Nothing in Stage 2 changes as a result: not building those things
> was correct either way.

Not planned for any stage: boss enemies, multiple weapons, mobile controls, a settings menu,
achievements, i18n, multiplayer.

One specific restraint worth recording because it was tempting: **`Health` was left completely
unchanged.** It is a dependency-free value object that `Player` and `Enemy` each construct, and
it is unit tested with no stubs at all. Giving it an event bus so it could announce damage
would have changed every construction site and every spec to no benefit — `CombatSystem` is
already the single place all damage resolves. The consequence is that Stage 2 has no
maximum-HP upgrade, which was accepted rather than worked around.

---

**Next:** [Pass A — content and curve](02-pass-a-content-and-curve.md)
