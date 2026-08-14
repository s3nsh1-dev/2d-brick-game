# Stage 3 — the brief

**Refinement and ship.** This is the last stage. When it lands, the game is deployed and the
project is finished.

**Self-contained.** Pointing a fresh session at this file, with no other context, is enough to
start work correctly — *once Stage 2 has landed*. Read §1 first; it may send you away.

---

## 0. Orient

Read, in this order, before writing anything:

1. `AGENTS.md` — stack, directory map, invariants 1–15. The authority. If any other document
   contradicts it, it wins.
2. `CLAUDE.md` — how to work in this repo.
3. `ARCHITECTURE.md` — the current stage, the frame pipeline, the scene lifecycle, the event
   catalogue.
4. `docs/STATUS.md` — what is built and what is known-broken.

Then read the code you are about to change. Stage 3 is mostly **presentation and scenes**, so
the files that matter most are:

```
src/scenes/          all eight scenes — this is where most of Stage 3 lands
src/systems/VfxSystem.ts, src/systems/AudioSystem.ts
src/constants/balance.ts
src/core/SaveStore.ts
index.html, vite.config.ts
```

You do **not** need to read `src/systems/CombatSystem.ts`, `SpawnSystem.ts` or `PickupSystem.ts`
in depth. Stage 3 does not change them. If you find yourself editing one, stop and re-read §3.

---

## 1. Gate — is Stage 3 actually next?

`ARCHITECTURE.md` is the authority on the current stage. Stage 3 begins only when Stage 2 is
**fully** complete — all five passes, not four.

Verify in one command. Every one of these must hit:

```bash
grep -rl "AudioSystem\|VfxSystem\|Animator\|StatBlock\|SaveStore\|xpCurve\|upgrades.json" src/
```

And these files must all exist:

```
src/components/Animator.ts        src/components/Stats.ts
src/systems/AudioSystem.ts        src/systems/VfxSystem.ts
src/systems/ProgressionSystem.ts  src/entities/FloatingText.ts
src/core/StatBlock.ts             src/core/xpCurve.ts
src/core/SaveStore.ts             src/core/audioSynth.ts
src/data/upgrades.json            src/scenes/UpgradeScene.ts
src/scenes/PauseScene.ts
```

`AGENTS.md` must carry invariants **11–15**. If it stops at 10, Stage 2 is not done.

**If any of that is missing, stop.** Go to `docs/STAGE_2_INSTRUCTIONS.md` and finish the stage.
Starting Stage 3 on an incomplete Stage 2 is the failure mode this project is structured to
prevent — and it fails worse here than anywhere else, because Stage 3 is a *polish* stage and
polishing something unfinished produces a pretty half-game.

---

## 2. Why this document was rewritten

**The previous Stage 3 was a different stage entirely, and it was cancelled deliberately.**
Recording why, because the reasoning was sound and someone will find the old plan in git
history and wonder.

### 2a. What the old Stage 3 was

Move the entire simulation out of Phaser. npm workspaces, `packages/sim` + `packages/game`, a
hand-written integrator and broadphase replacing Arcade Physics, seeded PCG32, fixed timestep,
replay recording, an optional ECS refactor, an optional flow-field pathfinder in a web worker,
an optional Fastify server that re-runs replays to validate leaderboard scores.

It was a real plan, and its central argument was correct: invariant 1 — *`src/core/` never
imports Phaser* — has cost effort in every session since Stage 1, and portability had bought
nothing yet. That plan was where the bill got collected.

### 2b. Why it is not happening

The project's owner made the call: **this project ships as a game, not as an architecture
proof.** Stage 3 is now the last stage before deployment, and a stage that ends with *"nobody
can tell the Stage 2 game from the Stage 3 game by playing it"* — the old document's own words —
is the wrong last stage for a project that is about to be deployed.

That is a scope decision, not a discovery. It does not make the old plan wrong.

### 2c. The cost of the decision, stated plainly so nobody has to re-derive it

Do not paper over this. Two things are now true and will stay true:

1. **Invariant 1 is partially unrealised, and that is now accepted.** `src/core/` stays
   Phaser-free, and it still pays for itself — `StatBlock`, `xpCurve`, `SaveStore` and the
   audio synthesis are unit-tested in bare Node with no DOM shim, which is a genuine and daily
   return. What it does *not* buy any more is the headless simulation. Keep the invariant: the
   testability is worth it on its own. Do not spend a session "completing" it.

2. **Determinism, replay and server-validated scores are permanently out.** They are all
   downstream of the sim/view split. If a future project wants them, they are designed in
   `git log` — the old brief is recoverable. They are not deferred to a Stage 4. There is no
   Stage 4.

### 2d. What Stage 3 is instead

**The game gets good.** Everything Stage 2 built works but looks like a programmer's test
harness: solid-colour squares on a flat void, monospace text at three sizes, no transitions, no
options, and a production build nobody has tried to host.

Stage 2 proved the architecture survives content. **Stage 3 makes the result something a person
would want to play and you would want to show someone.** Then it ships.

This is a smaller stage than the old one and a much less risky one. Every pass is independently
shippable, none of them can leave the game unplayable, and there is no pass that has to be
reverted.

---

## 3. Scope — the line, and how to tell which side you are on

Stage 3 changes **how the game looks, sounds, reads, performs, and deploys.** It does not change
**what the game does.**

### The test

> **Does this change where an entity ends up, how much damage it takes, or when a wave starts?**
>
> If yes, it is out of scope. If no, it is in.

That is invariant 16 below, and it is the whole of Stage 3's discipline. Stage 2 Pass C
deliberately crossed this line once, for knockback and hit-stop, and said so loudly. Stage 3
never crosses it.

### In scope

Visual identity · arena background and framing · scene transitions · every scene's UI ·
readability at 200 enemies · camera behaviour · options and accessibility · measured performance
work · bundle size · production build · hosting · the deploy runbook.

### Out of scope — do not build, do not stub, do not hook

| Not this | Why |
|---|---|
| Moving game rules out of Phaser, workspaces, `packages/*` | §2b. Cancelled, not deferred |
| Custom integrator, broadphase, fixed timestep, seeded RNG, replay | Downstream of the above |
| ECS, `bitecs`, web workers, pathfinding, arena obstacles | Same |
| Backend, server, leaderboard, accounts | Same |
| New enemy types, new waves, boss enemies, multiple weapons | Content is finished. Stage 2 tuned the curve; retuning it invalidates that work |
| **Any balance change at all** | `balance.ts` and `waves.json` are frozen. See below |
| Level editor | It was only ever justified by the sim/view split |
| Mobile touch controls, i18n, achievements, online multiplayer | Never planned, still not planned |

### `balance.ts` and `waves.json` are frozen

Stage 2 tuned the difficulty curve against a measured 37.5 dps clear rate and verified the fail
state in a browser. That measurement is the only evidence the game is tuned at all, and editing
either file discards it.

**Two exceptions, both narrow:**

- Stage 3 adds new keys to `balance.ts` for its own tunables — UI palette, transition durations,
  camera parameters, options defaults. **Adding a key is fine. Changing an existing gameplay
  number is not.**
- If a Stage 3 pass makes the game measurably harder or easier as a *side effect* — a slower
  scene transition eating reaction time, a background that hides projectiles — the fix is in the
  Stage 3 change, never in the balance file.

If you genuinely believe a gameplay number is wrong, say so in prose and leave it. That is a
finding for the owner, not a diff.

---

## 4. Where the project actually stands

Written against the shipped Stage 2 code so no session plans against an imagined baseline.
**Verify the numbers rather than trusting them** — run the four checks and count the files.

### 4a. What Stage 2 left you, and why it matters here

| Foundation | Where | Why Stage 3 cares |
|---|---|---|
| Presentation is event-driven and one-directional (inv. 11) | `AudioSystem`, `VfxSystem` | Every effect Stage 3 adds subscribes. You never call `camera.shake()` from gameplay |
| Emitters and sounds created once at init (inv. 12) | `VfxSystem`, `AudioSystem` | The pattern for any new effect already exists. Follow it |
| Boot-time texture baking, one texture per frame per definition | `PreloadScene` | The art pipeline is a loop over data. A new visual is a bake call, not an asset |
| Boot-time audio synthesis, no files | `core/audioSynth.ts` | The repo is asset-free. **Keep it that way** — see §6 |
| Stats computed, never mutated (inv. 14) | `core/StatBlock.ts` | Options that scale a value plug in here rather than mutating anything |
| Versioned zod-validated save (inv. 15) | `core/SaveStore.ts` | Options persistence has a home already. Do not invent a second one |
| Scene teardown verified by listener census (inv. 9) | `GameScene.shutdown` | Every scene Stage 3 adds or changes must extend the census |

### 4b. The honest state of the presentation

This is what Stage 3 exists to fix. Not complaints — a work list.

- **The arena is a flat `#14141c` rectangle.** No ground, no edge, no depth. Nothing tells the
  player where the world stops except that they cannot walk further.
- **Every scene is `monospace` text at three sizes**, centre-aligned, on the same flat
  background. Menu, game over, upgrade and pause are visually the same screen with different
  words.
- **Scene changes are hard cuts.** `scene.start()` with no fade, in both directions.
- **The HUD is a rectangle and two labels** in the corners. It does not react to anything —
  taking a hit and gaining XP look identical.
- **Nothing on screen distinguishes a nearly-dead brute from a fresh one.** At 200 enemies the
  screen is coloured squares moving toward the centre, and the player cannot read threat.
- **There is no way to change anything.** Stage 2 shipped master/SFX/music volume in
  `AudioSystem` with **no UI attached to it** — the fields exist and nothing can reach them.
- **The build has never been hosted.** ~1.46 MB / ~382 kB gzip, one chunk, no favicon, `<title>arena</title>`,
  no meta tags, no error boundary if the boot sequence throws in production.

---

## 5. Precondition — verify before writing anything

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Then, separately, `npm run dev` and confirm an empty browser console. It is a long-running
server, so it cannot be the last link in an `&&` chain — the chain would never return.

Do not start on a broken baseline, and do not "fix it while you're in there".

---

## 6. Decisions already made

Settled, with reasons, so no session re-litigates them. Overrule any of them if you have a
better argument — but state the argument in prose first.

| Decision | Instead of | Why |
|---|---|---|
| **The repo stays asset-free.** All art baked from `Graphics`, all audio synthesized in `core/` | shipping PNGs, sprite sheets, `.ogg` files | It is the single most distinctive property this codebase has, it survived two stages, and it makes every visual a data change rather than an asset-pipeline change. A "real" art pass is not what makes this game good — coherence is |
| **A palette lives in `balance.ts` and every colour references it** | hex literals per scene | Invariant 5 already bans loose numbers, and colours are the ones that drift first. One palette object is also what makes a colourblind mode a five-line change instead of a sweep |
| **Options persist through the existing `SaveStore`** | a second `localStorage` key, or none | Invariant 15 already solved versioning and corruption. A second store is a second migration path |
| **A shared UI kit in `src/ui/`** | hand-built text in each scene | Five scenes currently repeat the same `add.text(...).setOrigin(0.5).setDepth(...)` block with different strings. That repetition is why they look identical and why restyling is a five-file edit |
| **`src/ui/` is a new top-level folder, not `src/components/`** | putting it in `components/` | `components/` is *behaviour attached to entities* per the directory map. UI widgets are neither. A new folder with one job is cheaper than blurring an existing one — add it to the map in `AGENTS.md` |
| **Deploy target is a static host** (Vercel, Netlify, GitHub Pages, itch.io) | a Node server | `npm run build` emits static files and the game has no backend. Anything more is operational weight for zero gain |
| **No new runtime dependencies** | a UI framework, a tween library, a sound library | Phaser has tweens, timers, cameras, text and audio. Everything Stage 3 needs is in the engine already. Dev dependencies for tooling are a separate question — still ask first |

### New dependencies

**None are pre-approved.** The list above is deliberately empty of runtime packages. If a pass
genuinely needs one, make the case and wait — `AGENTS.md`, Never, rule 1.

---

## 7. The passes

Six passes. **One pass per session. Stop between each.** Do not prepare for a later pass inside
an earlier one — no `theme?: Theme` field "so Pass E is easier", no `// TODO: options here`.

Every pass ends on a green four-check baseline and a playable game. If a pass cannot end that
way, revert it rather than carry it forward.

Passes A–D are the stage. **E and F are also required** — this is a shipping stage, and a game
with no options that has never been hosted is not shipped. The optional-pass structure of
earlier stages does not apply here.

---

### Pass A — visual identity and the arena

**The problem:** the game is squares on a void. There is no art direction to be inconsistent
with, which is why every later pass has nothing to anchor to.

Build, in this order:

1. **The palette.** One `BALANCE.palette` object: background layers, arena surface, arena edge,
   UI foreground/dim/accent, danger, and the entity colours that already exist. Every existing
   colour in `balance.ts` and `enemies.json` moves to reference it or is justified where it
   sits. This is the anchor for everything after it.
2. **The arena floor and edge.** The world is 1280×720 and the player is clamped to it, but
   nothing draws that boundary. Give the arena a surface distinct from the outside, and an edge
   the player can read at a glance. A subtle grid or texture at very low contrast is enough —
   the enemies must stay the highest-contrast thing on screen.
3. **Depth.** A vignette, a slight background gradient, or a parallax layer. One technique, done
   well. This is where the game stops looking flat.
4. **Spawn telegraphing.** Enemies currently appear from off-screen with no warning. A brief
   marker at the spawn edge — read from the same `wave:started`/spawn events, in `VfxSystem` —
   turns "an enemy appeared behind me" into "I was told and did not look".

Read `graphics-and-shapes`, `render-textures` and `cameras` in `node_modules/phaser/skills/`
before writing. A static background drawn once into a `RenderTexture` costs one draw call; the
same background rebuilt per frame in a `Graphics` object costs a great deal more, and the
difference is Pass D's problem if you get it wrong here.

**Watch the readability trap.** Every element added behind the entities competes with them. After
each addition, run a wave 8 and confirm you can still track projectiles and read enemy positions.
If you cannot, the background is too loud — that is the whole reason contrast is named here
rather than left to taste.

**Done when:** a screenshot of the arena is recognisably *a game* rather than a test harness,
nothing on the gameplay layer is harder to see than it was, and the four checks pass.

---

### Pass B — the UI kit and every scene

**The problem:** five scenes repeat the same three `add.text()` calls and therefore look
identical, and there is no way to restyle without editing all of them.

1. **`src/ui/` — a small kit, built for the screens that exist.** A panel, a title, a body
   label, a button with hover and press states, and whatever the upgrade cards need. Resist
   generalising: build the five or six widgets these eight scenes actually use. A widget with
   one caller is fine; a widget with zero callers is Stage 3's version of speculative generality
   and is the thing this project exists to teach you not to write.
2. **Restyle every scene against the kit.** `MenuScene`, `HUDScene`, `UpgradeScene`,
   `PauseScene`, `GameOverScene`. When you are done, changing the accent colour is one edit in
   `balance.ts`.
3. **Scene transitions.** Hard cuts everywhere today. Use the camera's fade in/out — read the
   `cameras` skill — and keep them short: 200–300ms. A transition the player waits through twice
   is worse than a cut.
4. **Make the HUD react.** Health that flashes and drains rather than jumping. XP that reads as
   progress toward the next level, not a bare integer — Stage 2's `xpCurve` already knows where
   the next threshold is, and `HUDScene` can learn it from a bus event without holding a
   reference to anything.
5. **The game over screen earns its place.** It has real numbers to show now: wave reached, XP,
   level, upgrades taken, and — via `SaveStore` — whether this run beat the best one. A new
   personal best should be unmissable.

Invariant 3 still holds: `HUDScene` holds no reference into the run. If it needs a number it
does not have, that is a bus event, and it gets a row in `ARCHITECTURE.md`'s catalogue.

Read `text-and-bitmaptext`, `tweens` and `scenes` before writing.

**Done when:** every scene is visually one product, changing the accent colour is one edit, no
scene builds a text object without the kit, and the four checks pass.

---

### Pass C — readability and feel at scale

**The problem:** Stage 2's effects were built and verified against a handful of enemies. At wave
8 there are 200, and every effect fires 200 times.

1. **Enemy health must be readable.** A brute at 6× HP takes many hits and looks identical the
   whole time. Tint toward damage, or a thin bar on large enemies only, or a shell that cracks.
   **Not a health bar over every enemy** — 200 of them is unreadable and it is Pass D's problem
   immediately.
2. **Effect budgets.** Invariant 13 coalesces identical sounds in a window; the same discipline
   now applies to visuals. Forty deaths in one frame must not be forty particle bursts and forty
   floating numbers. Cap concurrent effects, and make the cap a `balance.ts` number.
3. **Damage numbers that help.** Floating text at 200 enemies is noise. Aggregate, or show only
   crits and player damage, or fade fast. Decide, comment the decision, tune it against a wave 8.
4. **Camera.** Stage 2 shakes on player damage. Consider a slight lead toward the pointer or the
   player's motion, and confirm that any camera movement at all still leaves the arena edge
   visible — the arena is exactly the viewport, so a camera that pans reveals nothing but
   background. **If the camera cannot move without breaking the arena framing, say so and leave
   it fixed.** That is a legitimate finding, not a failed task.
5. **Death and level-up should feel different from each other.** They are the two moments that
   matter and they currently both resolve to "some particles".

**This is the pass most likely to drift into gameplay.** Tinting an enemy is presentation.
Making a nearly-dead enemy slower is not. Re-read §3 when in doubt.

**Done when:** you can play wave 8 and read the board — threat, health, your own damage — and
the four checks pass.

---

### Pass D — performance, measured

**Measure first. Record the number in the commit message. Then optimise.** A pass that reports a
conclusion without a measurement has failed even if the code is faster.

`AGENTS.md`'s budget is 60fps at 200 enemies and 100 projectiles. **Nobody has verified it since
Stage 1**, and Stage 2 added animations, particles, floating text and audio on top.

1. **Establish the baseline.** Wave 8 with pools near capacity, in a production build (`npm run
   build && npm run preview`), not the dev server. Record frame time, draw calls, and heap
   growth over sixty seconds. Chrome's performance panel is the tool; the numbers go in the
   commit and in `AGENTS.md`'s budget section.
2. **Then look at the three things most likely to be wrong**, in this order:

   - **Batch breaks.** Every enemy definition bakes its own texture, and Pass B of Stage 2 baked
     one texture *per animation frame per definition*. Same-texture sprites batch; different
     textures break the batch. This is the moment **an atlas finally earns its place** — Stage 2
     §4a deferred it explicitly with *"sprite-count batching is a Stage 3 problem"*, and this is
     that problem. Bake the frames into one `RenderTexture` and address them as regions.
     **Measure before and after.** If the draw-call count was never the bottleneck, do not do it.
   - **`Text` objects.** Every Phaser `Text` owns a canvas and re-rasterises on `setText`.
     Floating damage numbers do exactly that, potentially many times a frame. `BitmapText` draws
     from a baked glyph texture and does not. Read `text-and-bitmaptext`. Same rule: measure.
   - **Allocation in update paths.** Invariant 6 bans `new`, but closures, array literals, object
     literals and string concatenation all allocate too — and `setText(\`XP ${n}\`)` allocates a
     string every time it is called. Record heap growth over sixty seconds before and after.
3. **Bundle size.** ~1.46 MB raw / ~382 kB gzip, all Phaser. Check whether Phaser 4 supports a
   custom build excluding unused subsystems — this project uses no tilemaps, no Matter physics,
   no video, no DOM elements. Check `node_modules/phaser/` for build documentation before
   assuming either way. If it does not, say so and leave it; `vite.config.ts`'s raised warning
   limit is then permanent and should be commented as such.

**Abort criteria, and take them seriously.** If an optimisation does not measurably improve the
recorded baseline, **revert it and record the negative result.** A negative result is a
successful pass — it converts "we should probably atlas this" into "we measured it and it was
not the bottleneck", permanently, for whoever reads this next.

**Done when:** the budget in `AGENTS.md` is rewritten against measured numbers, every
optimisation kept has a before/after in its commit, and the four checks pass.

---

### Pass E — options and accessibility

**This pass reverses an earlier decision, deliberately.** `AGENTS.md` and both earlier stage
briefs list a settings menu under "explicitly not planned". That was correct when the game had
nothing to configure. Stage 2 then shipped **master, SFX and music volume with no UI able to
reach them**, which is a half-built feature, and a shipping game that cannot be muted is not
shippable. Recorded here so the reversal is visible rather than quietly assumed.

Keep it small. This is not a settings framework.

1. **`OptionsScene`**, reachable from `MenuScene` and from `PauseScene`.
2. **Volume:** master, SFX, music. Wired to the fields `AudioSystem` already exposes.
3. **Reduced motion:** one toggle that disables screen shake and hit-stop, and damps particle
   counts. Read by `VfxSystem` — and by `CombatSystem` for hit-stop, which is the one place
   Stage 3 legitimately touches a gameplay file. **Hit-stop off changes timing, so it must be
   off-by-default-off**: the toggle removes an effect, it never adds an advantage.
4. **A colourblind-safe palette variant.** Pass A put every colour in one object; this is
   selecting a second one. The enemy types currently separate on red/pink/purple, which is the
   worst axis for the most common deficiency.
5. **Persist through `SaveStore`**, in the existing versioned record. Bump the schema version and
   exercise the migration path — Stage 2 wrote one and this is the first thing that uses it.

**Done when:** every option persists across a reload, reduced motion visibly calms the screen,
the colourblind palette separates all three enemy types, corrupt save data still boots, and the
four checks pass.

---

### Pass F — ship

The last pass in the project.

1. **Production hardening.** If the boot sequence throws — malformed JSON, a failed texture bake
   — the player currently gets a black rectangle and a console they will not open. Catch it and
   render a plain "something went wrong" state. This is the one place a user-facing error string
   is worth writing.
2. **The page around the game.** `index.html` is Stage 1's placeholder: `<title>arena</title>`,
   an empty-data-URI favicon, no description, no Open Graph tags, no loading state before Phaser
   boots. A shared link should look like something.
3. **A real favicon**, baked or inlined as an SVG data URI — the asset-free rule holds here too.
4. **Build check.** `npm run build` warning-free, `npm run preview` played end-to-end, console
   empty in the *production* build. Confirm the game still fits and scales correctly at common
   window sizes — read `scale-and-responsive`; the config is `Scale.FIT` with `CENTER_BOTH` and
   has never been checked against a small laptop viewport.
5. **Deploy.** Static host (§6). Record the URL in `README.md`.
6. **Close the documentation out.**
   - `ARCHITECTURE.md`: current stage → Stage 3 complete; `src/ui/` in the directory map; the
     event catalogue updated with every event Stage 3 added; "which file do I touch" gets rows
     for *change how the game looks* and *add a UI widget*.
   - `AGENTS.md`: invariants 16–20, the stage table marked complete, the performance budget
     rewritten against Pass D's measurements, `src/ui/` in the directory map.
   - `docs/STATUS.md`: per its own §6 checklist. The mermaid diagram in §3 must show all three
     stages complete.
   - `README.md`: the deployed URL, and a screenshot that is now worth taking.

**Done when:** someone who has never seen the repo can open a URL and play it.

---

## 8. New invariants — Stage 3 adds these to `AGENTS.md`

Numbered **16–20**, on the assumption that Stage 2 added exactly 11–15, which its brief commits
to. If Stage 2 shipped a different count, renumber and say so rather than leaving a collision.

16. **Stage 3 changes no gameplay outcome.** If a diff changes where an entity ends up, how much
    damage anything takes, or when a wave starts, it does not belong in this stage.
    `constants/balance.ts` may gain presentation keys; its existing gameplay numbers and every
    value in `waves.json` and `enemies.json` are frozen.

17. **Every colour comes from the palette.** No hex literal outside `BALANCE.palette`. A colour
    typed into a scene, a system or an entity is a bug in the same way a magic number is
    (invariant 5), and it is what makes a theme variant a sweep instead of an edit.

18. **UI is composed, not hand-built.** Scenes assemble widgets from `src/ui/`. A scene that
    calls `this.add.text()` directly is bypassing the kit, and the next restyle will miss it.

19. **Any effect that moves the screen can be turned off.** Screen shake, hit-stop, flashes and
    heavy particle bursts are all reachable from one reduced-motion setting. An accessibility
    toggle may remove an effect; it may never confer an advantage.

20. **Optimisation requires a measurement.** No performance change lands without a before/after
    number in its commit message. A reverted optimisation with a recorded negative result is a
    successful outcome and must be written down, not discarded.

---

## 9. Testing

`vitest.config.ts` is `environment: 'node'` and stays that way. Stage 3 is mostly rendering, and
rendering is verified by playing — that is not a gap, it is the same rule `AGENTS.md` has had
since Stage 1.

What *is* testable, and therefore must be tested:

- **The palette module** — every key resolves; a theme variant defines the same key set as the
  default, so a missing colour is a failing test rather than a black square in one mode.
- **`SaveStore` options round-trip** — including the version bump Pass E introduces. Old-version
  save migrates; corrupt save discards and boots with defaults.
- **Any pure helper Pass D introduces** — a formatter, a budget counter, a colour transform.
  These go in `core/`, and the invariant-1 lint rule already covers them.

Do not add a DOM shim to test a scene. If you want a scene tested, the logic worth testing does
not belong in the scene.

---

## 10. Definition of done for Stage 3

All six passes. There are no optional passes in this stage.

- `typecheck`, `lint`, `test`, `build` all pass, zero warnings.
- The **production** build runs with an empty console, played from menu to death to restart.
- Every scene is visually one product, and the accent colour is one edit.
- Wave 8 is readable — threat, health and your own damage are all legible at 200 enemies.
- 60fps at the `AGENTS.md` budget, **measured in a production build**, with the numbers recorded.
- Every option persists across reload; reduced motion works; the colourblind palette separates
  all three enemy types.
- `git diff` against the Stage 2 tag shows **no change to `waves.json`, no change to
  `enemies.json`, and no change to an existing gameplay value in `balance.ts`.** This is
  mechanically checkable and it is the single best evidence invariant 16 held.
- `AGENTS.md` carries invariants 16–20 and a measured performance budget; `ARCHITECTURE.md`,
  `docs/STATUS.md` and `README.md` are updated per Pass F.
- **The game is deployed and the URL is in `README.md`.**

---

## 11. Phaser 4 notes

Your recall for Phaser is overwhelmingly v3, and v4 is a rewrite. Assume it is stale.

- `node_modules/phaser/skills/` ships **28 skill files**. For Stage 3 the relevant ones are
  `cameras`, `tweens`, `text-and-bitmaptext`, `graphics-and-shapes`, `render-textures`,
  `scenes`, `scale-and-responsive`, `particles`, `filters-and-postfx` and `game-setup-and-config`.
  **Read the one you need before writing against that subsystem.**
- `node_modules/phaser/types/` is ground truth when a skill and your memory disagree.
- `Graphics#generateTexture` survives in v4; `Create.GenerateTexture` and
  `TextureManager.generate` were removed. The whole art pipeline rests on this.
- Particles are Game Objects created with `this.add.particles(x, y, texture, config)`. There is
  no separate manager and no `createEmitter`.
- The v3 pipeline system is gone, replaced by a node-based renderer. Anything in your memory
  about `pipeline` or custom shaders is v3 and will not compile — check `filters-and-postfx`
  before planning any post-processing.
- `import * as Phaser from 'phaser'` — the default export was removed.
- Confidently writing a v4 API you have not verified is worse than saying "let me check the
  types first".

---

## 12. How to work

One pass per session. State each file's job in one line before its code. Comment the *why*,
never the *what*.

Measure before you optimise, and report the number rather than the conclusion.

If a pass reveals that an earlier stage's design was wrong, **say so plainly** rather than
absorbing the damage silently. Both earlier briefs carry corrections that came from reading the
shipped code instead of trusting the plan, and each one removed work that would otherwise have
been done and thrown away. This document is the third such correction — see §2.

And when it ships: update `docs/STATUS.md` one last time, tag it, and stop. A finished project
that stays finished is the rarest artifact in this exercise.
