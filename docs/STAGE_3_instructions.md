# Stage 3 — the brief

**Self-contained.** Pointing a fresh session at this file, with no other context, is enough to
start work correctly — *once Stage 2 has landed*. Read §1 first; it may send you away.

---

## 0. Orient

Read `AGENTS.md`, `CLAUDE.md`, and `ARCHITECTURE.md` first. Then read `src/core/`,
`src/systems/`, and `src/entities/` **in full** — Stage 3 moves the boundary between them, and
you cannot plan that from a summary.

---

## 1. Gate — is Stage 3 actually next?

`ARCHITECTURE.md` is the authority on the current stage. As of 2026-08-14 the repo is at
**Stage 1 complete, Stage 2 not started**, verified by:

```bash
grep -rniE "upgrade|audiosystem|vfxsystem|statblock|savestore|xpcurve|animator|particle|shake|knockback|swarmer|brute|localstorage|enemies\.json" src/
```

Zero hits, and `enemyIdSchema` is still `z.literal('grunt')`. The branch name `feature/stage2`
is aspirational.

**If that is still true when you read this, stop.** Go to `docs/STAGE_2_INSTRUCTIONS.md`.
Starting Stage 3 on a Stage 1 codebase to "get ahead" is the exact failure mode this project is
structured to prevent, and it would cost you the Pass A → Pass B ordering below.

When Stage 2 *has* landed, do not take its word for it — **run §9 of the Stage 2 brief, the
Stage 3 readiness gate.** It is seven checks. Three of them (`src/core/` still Phaser-free;
`src/systems/` still free of runtime Phaser imports; every `Math.random` site inside a system)
are the load-bearing preconditions for Passes A, B and C respectively. If one fails, fixing it
is cheaper now than mid-pass.

Two passes additionally depend on Stage 2 content:

| Pass | Needs from Stage 2 |
|---|---|
| F — content editor | `enemies.json`, `upgrades.json` and their schemas. Without them the editor is a wave editor and little else. |
| G — backend leaderboard | Nothing structural, but "score" is currently a bare XP counter. Stage 2's progression is what makes a leaderboard mean anything. |

---

## 2. Why this, and why now

You asked whether this is a big change, why do it at all, why *this* design change, and whether
more features would be worth more than a structural upgrade — given this is a somewhat
beginner-level project. Those are the right questions and they deserve a real answer rather
than a plan that assumes them away.

### 2a. Is it big? Yes, and it is different in kind

Stage 1 built the thing. Stage 2 adds to the thing. **Stage 3 changes what the thing is.**

It will not add many lines — it relocates and rewrites the ones that matter most. The
simulation stops being a Phaser thing. By the end, the game rules run unmodified in the
browser, in a web worker, and in Node.

### 2b. Why do it, rather than keep adding features on the Stage 2 stack

The honest answer depends on what this project is *for*, and the README already says: *"It is
also a deliberate architecture exercise."* Both sides, fairly:

**The case for more features instead.** Every feature is cheap now — after Stage 2, a fourth
enemy is two JSON edits, a boss is a definition plus a flag, a second weapon is a component.
The game gets better for a player. Features finish, so there is less risk of stalling. And
Stage 3 has **zero player-visible benefit**: nobody can tell the Stage 2 game from the Stage 3
game by playing it. That is worth stating bluntly rather than burying.

**The case for the structural change.** Four reasons, in order of weight:

1. **You have already paid for Stage 3 and not collected.** Invariant 1 — `src/core/` never
   imports Phaser — has cost effort in every session since Stage 1: a scoped ESLint rule,
   positional-primitive event payloads so `core/` never names an entity type, scratch vectors
   in `core/math.ts`, an injected storage adapter in Stage 2's `SaveStore`. All of that is
   discipline in service of portability, and portability has bought **nothing** so far. Stage 3
   is where the bill is collected. Stop before it and invariant 1 was ceremony.

2. **The lesson does not repeat, and it does not transfer from a book.** *"How coupled is my
   game logic to my engine, really?"* can only be answered by removing the engine. Every
   developer believes their logic is decoupled; almost nobody has checked. This repo is
   currently 31 files and ~2,140 lines — small enough that checking takes a few sessions. That
   window closes as the project grows, and it never reopens.

3. **Diminishing returns on the alternative.** The tenth enemy type teaches you nothing the
   third did not. Stage 2 is precisely where the design gets tested against content pressure;
   past that, more content is repetition of a lesson already learned.

4. **It is the only item that unlocks the others.** Worker pathfinding, replay, deterministic
   testing and server-side score validation are all downstream of "the rules run without the
   engine". Not one is reachable otherwise. So even framed purely as features, this is the
   highest-leverage change available.

### 2c. Why *this* design change, and not ECS first

Because they answer different questions, and only one of them is a question you actually have.

- **ECS is a performance tool.** It answers *"how do I simulate 2000 entities?"* You do not
  have that problem: 220 pooled enemies, 120 projectiles, and a 60fps budget you are currently
  meeting. Leading with ECS would be optimising a bottleneck you have never measured. That is
  why it is Pass D, gated on a benchmark, with explicit abort criteria.
- **The sim/view split is a coupling tool.** It answers *"what does my game actually depend
  on?"* — the question this repo has been set up to ask since its first commit.

The ordering is also forced, not merely preferred:

- You **cannot** make the simulation deterministic while Arcade Physics owns integration.
  Phaser's step is not written to be reproducible tick-for-tick across machines, so Pass C is
  blocked on Pass B.
- You **cannot** run pathfinding in a worker while world state lives on Phaser sprites, because
  sprites do not cross a thread boundary. Pass E is blocked on Pass B.
- You **cannot** validate a score on a server without a deterministic replay to re-run.
  Pass G is blocked on Pass C.

### 2d. The tradeoffs, stated plainly

| Cost | Gain |
|---|---|
| Passes A–C are three focused sessions **minimum**, realistically more | You find out how coupled you actually were — the most transferable result in the project |
| Pass B replaces a tested physics engine with your own integrator and broadphase. Contact timing *will* differ, and things will feel subtly wrong before they feel right | The whole game becomes testable in bare Node in milliseconds. Today scenes, systems and entities are untested and "verified by running the game" |
| You lose Arcade's free work: bodies, world bounds, overlap, quadtree, debug rendering. Circle-vs-circle contact and a uniform grid are ~100 lines each and well understood — but they are yours to debug now | A seed plus an input log reproduces any bug exactly. Very few hobby projects can do this |
| The workspace split makes every command longer and the tooling more complicated | Worker pathfinding, replay and server validation all become possible |
| **Zero player-visible benefit** | |

### 2e. The beginner concern, addressed directly

The risk is not that this is too hard. Every pass is individually tractable and the concepts
are standard. **The risk is half-finished** — stalling inside Pass B with the game less
playable than it was and no clean place to stop.

That is a manageable risk, and these are the mitigations as rules rather than hopes:

1. **Passes A, B and C are the stage.** D, E, F and G are optional and separately droppable.
   They are outside the definition of done in §8.
2. **Every pass ends on a green four-check baseline and a playable game.** If a pass cannot end
   that way, revert it rather than carry it forward. One pass per session exists for this.
3. **Pass A is reversible and mechanical.** It is worth doing on its own even if you stop
   immediately after, because it makes the coupling visible without changing any behaviour.
4. **Do Pass B on a branch, over a Stage 2 game you are happy with.** The Arcade version stays
   reachable in git. That is your escape hatch and you should expect to use it at least once.

### 2f. The recommendation

**Do Stage 2 first.** It is not optional, it is the more enjoyable work, and Stage 3 is gated
on it.

**Then do Stage 3 Passes A, B and C — and stop there to reassess.** A+B+C *is* the entire
architectural lesson. Everything after it teaches something narrower:

- **Pass D (ECS)** is worth running for the benchmark alone. The most likely outcome is that it
  fails the gate and you abort — and that is the correct, valuable result, not a wasted
  session.
- **Passes E, F and G** are three different side projects wearing this project's clothes. A
  pathfinder, an editor and a game server are each a fine thing to build, but they stress *your
  ability to build those things*, not this game's architecture. Take them only if you actively
  want one.

**And if the answer to "what is this project for" is "I want a game people play" — then stop
after Stage 2 and add features instead.** That is a legitimate answer, not a failure of nerve.
This document will still be here.

---

## 3. What Stage 3 does not touch

Stage 3 **relocates** Stage 2's gameplay code. It does not redesign it, retune it, or extend it.

Explicitly out of scope, because they are Stage 2's and are finished by the time you start:
art, animations, audio, particles, screen shake, floating text, knockback, hit-stop, enemy
definitions, the XP curve, upgrades, the save file, the pause and upgrade scenes, and **all
balance tuning**.

If Pass B changes the feel of the game — and it will, see §7 — the fix is in Pass B's contact
code, **not** in `waves.json` or `balance.ts`. Retuning balance during Stage 3 destroys the
only signal you have about whether the port was faithful.

Also out of scope for any stage: boss enemies, multiple weapons, mobile controls, settings
menu, achievements, i18n, online multiplayer.

---

## 4. Corrections against the Stage 1 code that actually shipped

The previous revision of this document predates Stage 1. Six of its claims describe a codebase
that is not in this repo. These change the pass ordering, so read them before planning.

### 4.1 Moving `src/core/` does not give you a simulation

The old Pass A said "move `src/core/` into `packages/sim/`, mechanical move only, zero
behaviour change". `src/core/` is three files — `EventBus.ts`, `math.ts`, `ObjectPool.ts`,
about 250 lines — and **none of them contains a game rule.** Moving them is an afternoon and
leaves you with a package that simulates nothing.

The game rules are in `src/systems/`. The game state is on Phaser sprites in `src/entities/`.
Two different problems, two different passes.

### 4.2 `src/systems/` is already runtime-portable, and that is the good news

`CombatSystem`, `PickupSystem`, `SpawnSystem` and `System.ts` contain **zero runtime Phaser
imports**. Their only coupling is `import type` on the entity classes, which is erased at
compile time. Verify:

```bash
grep -rn "from 'phaser'" src/systems/     # no hits
```

So the rules are closer to portable than the old plan assumed. What is *not* portable is the
state those rules read and write.

### 4.3 Phaser owns integration and collision, and no pass was allocated to take it back

This is the real work of Stage 3, and the old document did not mention it once.

Game code never writes a position. It writes velocity — `enemy.setVelocity()`,
`projectile.setVelocity()`, `gem.setVelocity()`, `player.setVelocity()` — and **Arcade Physics
integrates it** during Phaser's own step, after `GameScene.update()` returns. Contact detection
is Phaser's too: three `this.physics.add.overlap()` registrations in `GameScene.create()` call
back into `CombatSystem` and `PickupSystem`.

Delete `packages/game` and you delete the physics. Invariant 18 below — *"deleting
`packages/game` must leave a simulation that still runs headless"* — is therefore unsatisfiable
until the sim integrates its own motion and does its own broadphase. That is Pass B, it is the
hardest pass in the stage, and it is a genuine behaviour change.

Do not try to run Arcade Physics headless as a shortcut. It reintroduces Phaser into
`packages/sim`, and Phaser's step is not reproducible tick-for-tick across machines, which
kills Pass C.

### 4.4 `src/data/schema.ts` imports Phaser

The old target structure moved `schema.ts` wholesale into `packages/sim`, where invariant 16
forbids exactly that. The file is two things bolted together:

- the zod schemas and inferred types — portable, belong in `packages/sim`;
- `readWaveDataFromCache(cache)` and `getWaveData(registry)` — thin adapters over
  `Phaser.Cache.CacheManager` and `Phaser.Data.DataManager`, which stay in `packages/game`.

Split on that line in Pass A. The comment already in the file explains why those two functions
exist; the reasoning survives the move.

### 4.5 The determinism job is smaller than stated, and the transcendental ban was too wide

`Math.random` appears in exactly **five places, all inside `SpawnSystem.spawn()`** — the edge
picker and four coordinate rolls. There is no `Date.now` and no `performance.now` anywhere in
`src/`. Stage 2 will add more sites in `ProgressionSystem` for upgrade offers. Routing them
through a seeded generator is an hour, not a sweep.

The old invariant 17 banned `Math.sqrt` by implication alongside `sin`/`cos`/`pow`. That is
wrong, and it would have sent you to rewrite `core/math.ts` for nothing. ECMAScript leaves
`sin`, `cos`, `tan`, `pow`, `exp`, `log`, `atan2` and friends implementation-approximated —
genuinely not bit-identical across engines. **`sqrt` is not on that list.** It is the IEEE-754
correctly-rounded operation and every engine emits the hardware instruction. `setLength` and
`distanceSquared` transfer unchanged.

### 4.6 Flow-field pathfinding needs obstacles, and the arena has none

`BALANCE.world` is a bare 1280×720 rectangle. No walls, no props, nothing to path around. A
flow field over an empty arena computes, at every cell, the unit vector toward the player —
precisely what `CombatSystem.steerEnemies()` already computes in one line with no grid at all.

So Pass E has a prerequisite no stage ever specified: **static obstacles must exist.** That is
now decided rather than deferred — see §7, Pass E.

---

## 5. Precondition

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Then, separately, `npm run dev` with an empty console. It is a long-running server, so it
cannot be the last link in an `&&` chain.

Do not start on a broken baseline, and do not "fix it while you're in there".

---

## 6. Decisions already made

These were open questions in earlier revisions. They are settled, with reasons, so no session
re-litigates them. Overrule any of them if you have a better argument — but state the argument.

| Decision | Instead of | Why |
|---|---|---|
| **npm workspaces** | switching to pnpm | The repo is npm with a committed `package-lock.json`, and npm has had workspaces since v7. They do everything Pass A needs. Changing package manager churns the lockfile, CI, and every command in `AGENTS.md` for zero architectural gain |
| **Two packages: `sim` and `game`** | a third `packages/core` | `packages/sim` exports `core/`. A separate package for 250 lines buys nothing, and "sim is strictly upstream of view" is the same one-directional relationship invariant 18 is about |
| **Transferable `ArrayBuffer` with double-buffering** for worker comms | `SharedArrayBuffer` | SAB needs COOP/COEP headers on both the Vite dev server *and* production hosting. The flow field recomputes at a few Hz, so the copy cost is irrelevant. Transferables work everywhere with no deployment constraint |
| **Obstacles are axis-aligned rectangles in `arena.json`** | polygons, tilemaps, or a painted mask | Rectangles map to whole grid cells with no rasterisation ambiguity, and circle-vs-AABB is the simplest correct companion to the circle-vs-circle broadphase Pass B already builds. Full spec in Pass E |
| **Plain TypeScript + DOM for the editor** | React | The editor's value is that it shares the game's zod schemas. Adding a UI framework doubles the toolchain for what is a form and a canvas |
| **A single JSON file, written atomically, behind a `LeaderboardStore` interface** | MongoDB | Pass G's point is the network and trust boundaries; neither cares what the store is. A document database is real operational weight for a solo project. Write-temp-then-rename is durable enough for a leaderboard, and swapping the implementation later is an afternoon |
| **Passes F and G are outside the definition of done** | shipping all seven | See §2f |

### New dependencies — approve before installing

| Package | Pass | Why |
|---|---|---|
| `bitecs` | D | Struct-of-arrays ECS, zero-allocation queries. **Gated on the Pass D benchmark** — if the benchmark fails, this is never installed |
| `fastify` | G (optional) | Typed server, better TS ergonomics than Express |

That is the whole list. `mongodb` and `pnpm` were both dropped, see above. Nothing else without
making the case first.

---

## 7. The passes

Seven independently shippable passes. **One pass per session.** Do not begin a pass until the
previous one is confirmed, and do not prepare for a later pass inside an earlier one — no
`replay?:` fields, no `// TODO: worker here`.

### Target structure

```text
arena/                              npm workspace root
├─ package.json                     "workspaces": ["packages/*"]
├─ packages/
│  ├─ sim/                          NEW — the game rules, no engine
│  │  ├─ src/core/                  EventBus, math, ObjectPool — moved as-is
│  │  ├─ src/world.ts               entity state as plain data, not sprites
│  │  ├─ src/rng.ts                 seeded PCG32
│  │  ├─ src/step.ts                fixed-timestep tick(world, inputs, dt)
│  │  ├─ src/broadphase.ts          uniform grid, replaces Arcade overlap
│  │  ├─ src/systems/               moved from src/systems/
│  │  ├─ src/schema.ts              zod only — see correction 4.4
│  │  ├─ src/replay.ts              record + play back
│  │  ├─ src/pathfinding/flowField.ts
│  │  ├─ src/data/                  waves.json, enemies.json, upgrades.json, arena.json
│  │  └─ src/__tests__/
│  ├─ game/                         the Phaser client (Stages 1–2), now view-only
│  │  ├─ src/dataCache.ts           the two Phaser adapters from schema.ts
│  │  └─ src/workers/pathfinding.worker.ts
│  ├─ editor/                       optional — own Vite app
│  └─ server/                       optional — Fastify, validates replays
└─ .github/workflows/ci.yml         NEW
```

### Pass A — workspace split

Convert to npm workspaces. Move `src/core/` into `packages/sim/src/core/`, move the rest of the
game into `packages/game/`, split `schema.ts` per correction 4.4. Wire path aliases, TypeScript
project references, and the workspace-aware forms of all six npm scripts.

The systems move too, but **as-is** — they still take Phaser-typed entities at this point.
Making them engine-free is Pass B's job.

**Zero behaviour change.** The game plays identically, every spec passes, the build emits the
same output. If anything refuses to move because it secretly touched Phaser or the DOM, report
it — that is a real finding, not something to quietly patch.

**Done when:** all four commands pass from the workspace root, and `git diff` shows moves plus
config, with no logic edits.

### Pass B — the sim owns motion and contact

The hard one. Read correction 4.3 again before planning.

- `world.ts`: entity state as plain arrays or structs — position, velocity, health, cooldowns.
  No sprites.
- Integration in the sim: `position += velocity × dt`, world-bounds clamp for the player.
- `broadphase.ts`: a uniform grid sized to the largest entity radius, replacing the three
  `physics.add.overlap` registrations. Circle-vs-circle is enough — every entity is a square
  rendered from a rectangle texture and none of them rotate.
- `packages/game` becomes a view: a sprite pool that reads sim state each frame and writes `x`,
  `y`, `visible`. Arcade Physics comes out of `GameScene` entirely.

**This pass changes behaviour and that is expected.** Contact timing and enemy positions will
differ from Arcade's. What must **not** change: the wave timeline, damage numbers, cooldowns,
pool sizes, and the shape of a run. Report anything that shifts noticeably in feel — and fix it
in the contact code, never by retuning balance (§3).

**Done when:** `packages/game` can be deleted from the workspace and `packages/sim`'s tests
still run a full simulated run to completion under bare Node.

### Pass C — determinism and replay

- Seeded PCG32 in `sim/src/rng.ts`, threaded through every `Math.random` site. Grep and prove
  zero remain in `packages/sim`. Stage 2's `VfxSystem` jitter is exempt and lives in
  `packages/game`, which is the right side of the line.
- `tick(world, inputs)` as a pure function in `sim/src/step.ts`, on a fixed timestep with an
  accumulator and a catch-up cap (invariant 19).
- Input recording: per-tick input snapshots, run-length encoded.
- Replay playback mode in the client.

**Done when:** a Vitest spec runs the same seed and input log twice for 10,000 ticks and gets an
identical structural hash. Run it under Node, not jsdom — `vitest.config.ts` is already
`environment: 'node'` for exactly this reason.

### Pass D — ECS refactor, gated (optional)

Move entity simulation to `bitecs` inside `packages/sim`. Components become typed arrays.

**Benchmark first, and record the number.** The Stage 1 budget in `AGENTS.md` is 200 enemies
and 100 projectiles; the pools are sized 220 and 120. The Stage 3 stretch target is 2000
simultaneous enemies at 60fps. Measure what Pass B's plain-array world actually does before
assuming it needs replacing — Pass B already removed the Arcade quadtree and the 2000-sprite
display list, which is where the old ceiling almost certainly was.

**Abort criteria, and take them seriously.** If the ECS version does not beat the Pass B
implementation by at least 3× on entity count at 60fps: stop, report the numbers, revert, and
do not install `bitecs`. ECS is a performance tool, not a correctness one. A refactor that costs
readability and buys nothing is a bad trade, and the measurement is worth more than the
ideology. **Expect to abort.** That is a successful pass, not a failed one.

On the view side, 2000 individual `Sprite` objects will not hold 60fps. Before choosing a
replacement, read `node_modules/phaser/skills/` — the relevant ones are `sprites-and-images`,
`groups-and-containers`, `render-textures` and `v4-new-features`. There is **no `blitter`
skill** among the 28 shipped, so confirm against `node_modules/phaser/types/` whether `Blitter`
still exists in v4 before planning around it. Do not write it from Phaser 3 memory.

### Pass E — obstacles and worker pathfinding (optional)

Read correction 4.6 first: this pass needs static obstacles, which do not exist. **The geometry
is specified here rather than deferred to a design conversation.**

`packages/sim/src/data/arena.json`, zod-validated like every other content file. Content is a
list of axis-aligned rectangles in world coordinates, `{ x, y, width, height }`. Constraints,
all enforced by the schema so a bad layout fails at boot:

- **4–6 blockers.** Enough that a path can be wrong; few enough to debug by eye.
- **Symmetric about both axes**, so no spawn edge is advantaged and the flow field can be spot-
  checked against its own mirror image.
- **None within 200px of the arena centre**, which is where the player spawns.
- **None within 64px of the world bounds.** `BALANCE.spawn.ringMargin` is 48, so this keeps the
  spawn ring clear and guarantees no enemy is ever placed inside geometry.
- **Under 15% of total arena area blocked**, so the game still plays open rather than as a maze.

It is content, not balance — it is a layout, and layouts live in `src/data/` under the same rule
as waves.

Then the pathfinding itself: **flow field, one BFS over the grid per recompute, every enemy
reads a direction vector in O(1).** This is what crowd games actually use — do not write
per-enemy A*.

Runs in a web worker on the same `packages/sim` code, communicating over transferable
`ArrayBuffer`s with double-buffering (§6).

**Done when:** 2000 enemies navigate around the obstacles with no main-thread frame time
attributable to pathfinding.

### Pass F — content editor (optional, needs Stage 2)

Separate Vite app in `packages/editor`, plain TypeScript and DOM (§6). Visual editing for waves,
enemy definitions, upgrades and the arena layout, importing the same zod schemas from
`packages/sim` — **the editor cannot produce data the game rejects, by construction.** That
property is the entire point of the pass. Live-preview a wave against the headless sim. Export
writes JSON back to `packages/sim/src/data/`.

No UI framework in `packages/game`, whatever you choose here.

### Pass G — backend and validated leaderboard (optional)

Fastify plus a `LeaderboardStore` backed by one atomically-written JSON file (§6), in
`packages/server`.

- `POST /runs` accepts `{ seed, inputLog, claimedScore, version }`.
- The server re-runs the simulation via `packages/sim` and computes the real score.
- Mismatch beyond tolerance → reject and log.
- Input log length sanity-capped; rate limit by IP.
- `GET /leaderboard` returns verified runs only, with the replay retrievable so any score can be
  watched.
- Version-gated: a run recorded on an older sim version is stored but flagged, never validated
  against new balance.

Depends on Pass C. Without a deterministic replay there is nothing to re-run and the pass is
theatre.

**Done when:** you can forge `claimedScore` in the request body and the server rejects it.

---

## 8. New invariants — add to `AGENTS.md`

Numbered 16–20 **on the assumption that Stage 2 landed and added exactly 11–15**, which its
brief commits to. If Stage 2 shipped a different count, renumber and say so rather than leaving
a gap or a collision.

16. **`packages/sim` imports nothing environment-specific.** No Phaser, no DOM, no `window`, no
    Node built-ins. It must run byte-identically in browser, worker, and Node. Lint-enforce with
    `no-restricted-imports` — the existing rule in `eslint.config.js` under
    `files: ['src/core/**/*.ts']` is the pattern to widen — and add a CI job that runs the sim
    tests under plain Node.

17. **The simulation is deterministic.** Same seed plus same input sequence produces the same
    final state, every time, on every machine. That forbids `Math.random`, `Date.now`,
    `performance.now`, `for...in`, and iteration over insertion-ordered `Map`/`Set` where order
    affects results. It also forbids `Math.sin`, `cos`, `tan`, `pow`, `exp`, `log` and `atan2`
    in any path that decides a gameplay outcome — those are implementation-approximated in
    ECMAScript. Use lookup tables or fixed-point instead. **`Math.sqrt`, `abs`, `floor`, `min`
    and `max` are exact and are fine.**

18. **Data flows one way: sim → view.** The renderer reads simulation state and never writes to
    it. A Phaser sprite holds an entity id, not entity state. Deleting `packages/game` must
    leave a simulation that still runs headless.

19. **Fixed simulation timestep, decoupled from render rate.** The sim ticks at a constant rate
    driven by an accumulator; the view interpolates between the last two sim states. Render rate
    must not affect outcomes. This replaces `BALANCE.time.maxDeltaSeconds` as the
    backgrounded-tab defence — the accumulator needs its own clamp on how many catch-up ticks it
    will run in one frame, or a restored tab will spiral.

20. **Client scores are never trusted.** The server receives a seed plus an input log, re-runs
    the identical simulation, and compares. Submitted score fields are advisory only. *(Only
    relevant if Pass G is taken; add it then, not before.)*

---

## 9. Testing

`packages/sim` gets real coverage now — it is the whole game, and the existing rule that Vitest
covers only `core/` and `components/` is superseded for that package.

- **Broadphase**: same contact pairs as a brute-force O(n²) check, on randomised layouts.
- **Determinism**: same seed and inputs, identical hash, 10,000 ticks.
- **Replay**: a recorded run reproduces its recorded score.
- **Flow field** (Pass E): correctness against a brute-force BFS on small grids.
- **Arena schema** (Pass E): a layout violating any §7 constraint fails to parse.
- **Server** (Pass G): rejects forged scores, mismatched versions, oversized input logs.
- **CI** runs `packages/sim` tests under plain Node with no DOM shim. That is the enforcement
  mechanism for invariant 16, and the reason `vitest.config.ts` already uses
  `environment: 'node'`.

---

## 10. Definition of done for Stage 3

Passes A, B and C only. D–G are optional and explicitly outside this list (§2f).

- All packages pass `typecheck`, `lint`, `test`, `build`.
- `packages/sim` tests pass under bare Node with no DOM shim.
- `packages/game` can be deleted and the simulation still runs to completion.
- A recorded replay plays back tick-identical, verified by structural hash over 10,000 ticks.
- The game is still playable and still feels like the Stage 2 game, with no balance file edited.
- `ARCHITECTURE.md` rewritten for the sim/view split, with a diagram of the tick pipeline and
  the "which file do I touch" table updated for the workspace layout.
- `AGENTS.md` carries invariants 16–19 (20 only if Pass G was taken), its stage table marks
  Stage 3, and the performance budget section is rewritten against measured numbers.
- `docs/STATUS.md` snapshot table and §4 upgrade catalogue updated per its own §6 checklist.

If a pass beyond C is taken, add its own "done when" from §7 to this list.

---

## 11. How to work

One pass per session. Benchmark before you optimise, and report the numbers rather than the
conclusion.

If a pass reveals that an earlier stage's design was wrong, **say so plainly** — a correct
finding is worth more than a clean diff. This document is itself the proof: every correction in
§4 came from reading the shipped code instead of trusting the plan, and each one removed work
that would otherwise have been done and thrown away.

---
