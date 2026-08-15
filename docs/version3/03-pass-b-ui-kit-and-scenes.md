# Pass B — the UI kit and every scene

**The problem the brief named:** five scenes repeat the same three `add.text()` calls and
therefore look identical, and there is no way to restyle without editing all of them.

**What shipped:** `src/ui/` with six widgets, every scene rebuilt on them, camera-fade
transitions in both directions, and a HUD that reacts to what happens.

Commit: `feat(ui): a widget kit, and every scene rebuilt against it`.

---

## Six widgets, because nine scenes needed six widgets

| Widget | Callers | Why it exists |
|---|---|---|
| `Label` | every scene | Seven **role** variants — `TITLE`, `HEADING`, `BODY`, `DIM`, `ACCENT`, `SMALL`, `DANGER` — not seven sizes |
| `Panel` | menu, pause, options, game over | A filled rect with a border and a deliberate 0.94 alpha, so a panel over the arena admits the arena is there |
| `Button` | menu, pause, options, game over | Hover, press and *highlight* states. The third is for keyboard focus |
| `Bar` | HUD | Health and XP. Draining is the widget's job; deciding what to drain is the scene's |
| `UpgradeCard` | upgrade scene | The one widget with a single caller, and worth it: it is 60 lines of layout no scene should own |
| `UpgradeList` | HUD, game over | The `PICKED UP` tally, in two places with different framing |

Plus two helper modules that are not widgets — `backdrop.ts` (`addArenaBackdrop`, `addScrim`)
and `transitions.ts` — because a free function that adds one image is not a class.

**The variants are roles, not sizes.** `TITLE` means "the one thing this screen is about", not
"46 px". That distinction is the entire reason changing what a title looks like is an edit in
one file. A `LabelVariant.LARGE` would have been the same code with none of the benefit.

**There is no widget with zero callers.** The brief called a zero-caller widget "Stage 3's
version of speculative generality", and the temptation was real — a `Slider` for the volume
rows in particular. `OptionsScene` renders its volume meters itself, in about twelve lines,
because a slider that exists for three rows on one screen is a class that exists to look like
a UI kit rather than to be one.

---

## `src/ui/` is a new folder, and `src/platform/` is one the brief did not predict

The brief settled the first: `components/` is *behaviour attached to entities*, and a UI widget
is neither, so blurring an existing folder's job is more expensive than adding a row to the
directory map.

The second came out of the work. `SaveStore` takes a storage adapter because `core/` may not
name `window` — but the adapter itself has to live somewhere, and before Pass B it lived
inside `GameOverScene`. Every other scene that wanted the save imported it *from a scene*,
which is a coupling with no name. `src/platform/` is that name: browser APIs that are not
Phaser's. It holds the `localStorage` adapter and the live settings singleton, and it is the
honest answer to "where does the thing `core/` is forbidden to touch actually live".

---

## Transitions are camera fades, and that is not a stylistic choice

The brief said to read the `cameras` skill and keep transitions to 200–300 ms. They are 220 ms
in and 200 ms out. The reason they are **camera fades rather than tweens** is a property of
this codebase worth protecting:

> The game owns no tween and no `TimerEvent`. Every clock is a number decremented by `dt`.

That is what makes `scene.pause()` completely safe — there is no Phaser-owned timeline to keep
running behind a paused scene. Adding a tween for a fade would have introduced the first one,
for decoration, in the last stage of the project. `camera.fadeOut()` plus the
`FADE_OUT_COMPLETE` event does the same job through a system the scene already owns.

The durations were checked against the thing the brief warned about: a transition the player
waits through twice is worse than a cut, and a slow fade on the first frame of a wave eats
reaction time — which would be a *gameplay* change smuggled in as presentation.

---

## The HUD had to learn three things without being told

Invariant 3 says `HUDScene` holds no reference into the run. Pass B needed it to show the wave
count, the live level and the list of upgrades taken — none of which it had. All three arrived
without a reference:

- **Total waves** comes from the registry, not from `SpawnSystem`. The wave data is *content*,
  already validated at boot and already in the registry; reading content is not reaching into
  the run.
- **The live level** is derived from `xp:changed` through `core/xpCurve`, not from `level:up`.
  This one was a bug fix as much as a feature — see below.
- **The upgrade tally** accumulates `upgrade:chosen`, and the names come from the upgrade
  catalogue in the registry.

The cost of invariant 3 here was about fifteen lines. The benefit is that the HUD still cannot
break the game, and it still renders correctly when the scene beneath it is frozen.

### The level bug the HUD exposed

The owner reported *"there is no level after 22"*. It was two bugs wearing one coat:

1. **The HUD painted the level only on `level:up`.** So the display was correct exactly until
   the event stopped firing.
2. **`ProgressionSystem` skipped the whole level-up when fewer than three upgrades remained
   uncapped.** Pick-1-of-3 was implemented as *needs three*, so once the catalogue ran dry the
   player stopped levelling entirely.

The second is a real design fault from Stage 2 that only showed up in a long run. It now offers
one or two when that is all there is. The first is why the HUD derives the level from XP
instead: a display that reconstructs its value from the source of truth cannot drift, and a
display that latches an event can.

---

## The HUD owns the project's second `dt` conversion

Invariant 8 says `dt` is seconds, converted once in `GameScene.update()`. The draining health
bar needs a clock, and it must keep running while the game beneath it is paused — that is the
whole point of a bar that catches up smoothly rather than jumping.

So `HUDScene` converts milliseconds to seconds itself. It is the only other place in the
project that does, it is commented as such, and `ARCHITECTURE.md` records it. This is what the
"known deviations" section is for: an invariant with a written, reasoned exception is still an
invariant; an invariant with an undocumented one is a lie.

---

## The game over screen earns its place

It had real numbers to show and was showing none of them. It now shows wave reached, XP, level,
the upgrades taken, and whether the run beat the best one — with a new personal best made
unmissable rather than mentioned.

Two things came out of building it that were not visible on paper:

- **The captions collided with their own numbers.** `TITLE` is 46 px and centred, and a caption
  placed by eye at a comfortable-looking offset overlapped it. Layout offsets are the one class
  of number this project keeps in the scene, and the price is that they are verified by looking.
- **"nothing — the run ended early" is wrong on a victory.** The empty-state text for "you took
  no upgrades" assumed the run was cut short. After Pass G it could also mean *you won without
  needing any*, so the empty state depends on the `victory` flag. A default that was correct
  when written became wrong when the game gained a second ending.
