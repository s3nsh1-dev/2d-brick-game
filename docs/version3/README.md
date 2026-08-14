# Version 3 — Stage 3: refinement and ship

> **This folder is intentionally empty.** Stage 3 has not been built. Nothing here describes
> work that exists.
>
> Fill it *after* Stage 3 lands, the same way [`../version1/`](../version1/README.md) and
> [`../version2/`](../version2/README.md) were filled after their stages did — as history
> written from what actually happened, not as a plan written in advance.

For what Stage 3 is *supposed* to do, the authority is
[`../STAGE_3_instructions.md`](../STAGE_3_instructions.md). That is the brief. This is the
record, and the record is empty until there is something to record.

---

## What Stage 3 is

**Refinement and ship — the last stage.** When it lands, the game is deployed and the project
is finished. It is mostly scenes and presentation; it does not change the gameplay systems.

Read `docs/STAGE_3_instructions.md` §1 first: it opens with a gate that will send you away if
Stage 2 is not fully complete. (It is — all five passes landed 2026-08-14.)

### The Stage 3 that was cancelled

Worth knowing before you read git history and get confused. An earlier Stage 3 was a completely
different stage: move the entire simulation out of Phaser into `packages/sim`, replace Arcade
Physics with a hand-written integrator, seeded RNG, fixed timestep, replay recording, optional
ECS, optional worker pathfinding, optional replay-validating server.

It was cancelled deliberately — the project ships as a game, not as an architecture proof.
`STAGE_3_instructions.md` §2 records the reasoning and, more usefully, the two costs it accepts:
invariant 1 stays partially unrealised (still worth keeping for the testability), and
determinism, replay and server-validated scores are permanently out rather than deferred.

There is no Stage 4.

---

## Suggested shape when you write it

Mirror version 2, which mirrors the passes. Adjust to whatever Stage 3 actually turns out to be
— the structure below is a starting point, not a specification:

| # | Page | What it would cover |
|---|---|---|
| — | `README.md` | Replace this file: what Stage 3 delivered, the before/after table, the verification at close |
| 1 | `01-what-stage-3-proved.md` | The goal, the pass structure, why the passes were split where they were |
| 2..n | `0n-pass-<name>.md` | One page per pass: what it delivered, the decisions inside it, what was verified and how |
| last | `0n-difficulties-and-fixes.md` | What went wrong, what the brief got wrong, what a future reader should not have to rediscover |

Plus, because this is the stage that ends in a deployment, two things the earlier folders had no
reason to carry:

- **`deployment.md`** — where it is hosted, how a release is cut, what the rollback is, and what
  to check after a deploy. The one page whose absence hurts most at 2am.
- **`post-ship-notes.md`** — what real players hit that no amount of self-testing surfaced.

---

## What makes these folders worth writing

Stated here so the habit survives into the last stage, when the temptation to skip it is
strongest because the project is finishing.

**Record decisions, not descriptions.** The code says what it does. These pages say why it does
that and what the alternative was. A description of the code goes stale the moment the code
changes; a decision stays true because it is a fact about a moment.

**Record what was measured, and what was only assumed.** Version 1's most useful page is the
list of things that went wrong, and version 2's is the one where a brief's own numbers turned
out to be untrue. Both exist because someone wrote down the difference between a claim and a
measurement.

**Mark inference as inference.** Where version 1 reconstructs a rationale nobody recorded, it
says so. A confident-sounding guess in a history document is worse than a gap, because the next
reader cannot tell which is which.

**Write it while it is fresh.** Every one of these pages was written at the end of the stage it
describes. A month later, the "obvious" reasons are gone and only the code is left.
