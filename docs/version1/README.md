# Version 1 — Stage 1: the playable core

**What this folder is:** the development history of everything built before Stage 2 — what was
decided, why, what went wrong, and what a developer new to 2D games should take from it.

**What this folder is not:** a technical reference. It does not describe how the code works
today, because the code moved on. For the current state, read the live documents:

| For | Read |
|---|---|
| Game-development concepts, if you have never built a game | [`../ONBOARDING.md`](../ONBOARDING.md) |
| How the code fits together *today* | [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) |
| The rules that govern changes | [`../../AGENTS.md`](../../AGENTS.md) |
| What exists right now | [`../STATUS.md`](../STATUS.md) |

This folder is the *why*, frozen at the moment Stage 1 shipped. Where it describes code, treat
it as archaeology — Stage 2 changed some of it, and each page says so where it matters.

---

## The pages

| # | Page | What it covers |
|---|---|---|
| 1 | [The game, and why this genre](01-the-game-and-why-this-genre.md) | What `arena` is, and why an auto-firing survivor made of coloured rectangles is close to the ideal first 2D project |
| 2 | [Stack decisions](02-stack-decisions.md) | Phaser 4, TypeScript, Vite, zod, Vitest, ESLint — each choice, its alternatives, and what it bought |
| 3 | [Architecture decisions](03-architecture-decisions.md) | The ten invariants, each as a decision with its reasoning and its cost |
| 4 | [Features built](04-features-built.md) | Every Stage 1 feature and the smaller choices inside it |
| 5 | [Difficulties and fixes](05-difficulties-and-fixes.md) | The problems that actually cost time, and how each was resolved |
| 6 | [Lessons for a new 2D web dev](06-lessons-for-new-game-devs.md) | The practical things that bite a web developer, learned here rather than read somewhere |

---

## What Stage 1 was

A playable game with nothing decorative in it:

> Player movement, an auto-aiming weapon firing pooled projectiles, one enemy type with chase
> AI, wave-based spawning driven by JSON, collision damage in both directions, XP gems, an HP
> bar and wave counter in a parallel HUD scene, and game over with restart.

Everything else — art, audio, particles, upgrades, persistence — was explicitly **out of
scope**, not as an oversight but as the point of the exercise. The original brief is preserved
verbatim in [`../KICKSTART.md`](../KICKSTART.md).

Stage 1 shipped with `typecheck`, `lint`, `test` (50 specs across 5 files) and `build` all
clean, and an empty browser console.

---

## A note on confidence

This project was built rapidly, and not every decision left a written trace at the moment it
was made. Where a rationale was recorded — in `AGENTS.md`, in `KICKSTART.md`, or in a code
comment — these pages quote or paraphrase it.

Where it was not, the page says **“Reconstructed”** and gives the most probable reasoning based
on the code that exists and the constraints that were in force. Those passages are honest
inference, not recovered fact, and they are marked so you can weigh them accordingly.
