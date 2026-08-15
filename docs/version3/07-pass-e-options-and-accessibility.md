# Pass E — options and accessibility

**This pass reverses an earlier decision, on purpose.** `AGENTS.md` and both earlier stage
briefs listed a settings menu under "explicitly not planned". That was correct while there was
nothing to configure. Stage 2 then shipped master, SFX and music volume **with no UI able to
reach them** — a half-built feature — and a game that cannot be muted is not shippable.

Commit: `feat(options): volumes, reduced motion and a colourblind palette`.

---

## What shipped

`OptionsScene`, reachable from the menu and mid-run from pause, by mouse or keyboard:

| Option | Effect |
|---|---|
| Master / SFX / music volume | Ten notches each, wired to the fields `AudioSystem` already exposed |
| Reduced motion | Removes screen shake, damage flash and hit-stop; damps particle counts to 35% |
| Colourblind palette | Repaints the three enemy types onto an axis that survives a red-green deficiency |

All of it persists through the existing `SaveStore`, in the existing versioned record.

---

## Volume has to change audibly from a paused game

This is the constraint that shaped the design, and it is not obvious until you try it: the
options screen is opened over a **paused** run, and a paused scene's systems do not tick. A
system that polled the settings store in `update()` would apply nothing until the player
un-paused, which makes a volume slider useless exactly where it is most likely to be used.

So there is an `options:changed` event, and it **carries no payload**. The settings store is
the single source of truth; every listener reads it directly rather than being handed a copy
that can go stale. A bus listener is a plain function call and does not care that the scene
beneath it is frozen.

The store also carries a `revision` counter rather than an event of its own. Most consumers
read live and need nothing; `AudioSystem` holds one volume per `Sound` instance and needs to
know when to refresh, and comparing one integer is cheaper than subscribing.

---

## Reduced motion: the direction of the change is the safety property

Invariant 19 is written carefully:

> An accessibility toggle may remove an effect; it may never confer an advantage, and it may
> never remove *information*.

Two consequences:

- **Hit-stop is the one place Stage 3 legitimately touches a gameplay file.** It is 45 ms of
  frozen simulation on a kill, so switching it off genuinely changes timing. That is why the
  toggle must default to *off* — meaning hit-stop is on. The player can only ever remove the
  effect, never gain one. If the default were reversed, every player would be playing the
  no-hit-stop game and the toggle would be a difficulty setting.
- **Particles are damped to 35%, not zeroed.** An effect that vanishes entirely takes its
  information with it, and a player still needs to see that a hit landed. Damage numbers
  survive reduced motion untouched for the same reason. What it removes outright is the things
  that move the *screen*: shake, flash, hit-stop.

---

## The colourblind palette had to be baked, not tinted

The enemy types separate on red / pink / purple, which is the worst possible axis for the most
common deficiency. Pass A put every colour in one object precisely so this would be a small
change.

It was — but not the change that was planned. **`setTint` multiplies.** It can darken a baked
texture and can never brighten one, so there is no tint that turns a red square into an orange
one, and no tint that turns any of them white. Re-tinting the default art cannot produce a
different palette; it can only produce a darker version of the same one.

So `PreloadScene` bakes **both** palettes at boot, and `paletteActorId(id, colourblind)`
appends `__cb` to pick the variant. It costs three extra textures — measured in the same pass
that found 220 sprites cost 6–10 draw calls, so the cost is nil — and it works.

### Separating on luminance, so it can be tested

The colours are `0xff7a1a`, `0xf2f2f8`, `0x2f3bd6`, and they separate on **relative luminance
first** — 0.53 / 0.90 / 0.16 — and hue second. That matters twice:

- A palette that separates on luminance survives *every* deficiency, not just the one it was
  drawn for. Hue-only separation solves deuteranopia and fails protanopia.
- Luminance is a number, so `core/color.ts` computes it by the WCAG formula and a **unit test
  asserts the three are far apart**. The brief asked for a palette module test — "a missing
  colour is a failing test rather than a black square in one mode" — and this goes one better:
  the palette's actual *purpose* is asserted, not just its key set.

Size already separates the three types as well. Colour is the second cue, never the only one.

---

## The migration path's first real use

Invariant 15 gave `SaveStore` a schema version and a migration path in Stage 2, and nothing had
ever needed it. This did: the record gained a `settings` object and went to version 3.

Two migrations, v2→v3 and v1→v3, and one rule that matters more than the mechanism:

> **Both fill in `DEFAULT_SETTINGS`, which means both arrive with every accessibility option
> off.** A migration must never switch an accessibility option *on* for a player who never
> asked for it — least of all reduced motion, which changes how the game plays.

Verified in a real browser with a real v2 record, not only in tests. That distinction is
deliberate: the tests prove the function is correct, and the browser proves the function is
the one that runs at boot.

Corrupt data still boots with defaults, because `load` uses `safeParse` and falls back —
`parse` is for *content*, which must crash loudly, and `safeParse` is for *save data*, which
must never take the boot sequence down.

---

## Small things that were decided rather than defaulted

- **The options rows are a table**, `{ name, describe, step }`, rendered by a loop. Adding an
  option is a row, not a screen edit. This is the one place in the stage where a tiny
  generalisation paid for itself immediately — there are five rows and two kinds.
- **`setVolume` is not on `Phaser.Sound.BaseSound`.** It exists only on the concrete classes.
  The fix is `instanceof Phaser.Sound.WebAudioSound`, not a cast: invariant 10 bans the easy
  way out, and the narrow check is also more honest about what is true at runtime.
- **Keyboard navigation exists** because the game is played on WASD and reaching for the mouse
  to change a volume mid-run is exactly the moment an option is least usable.
