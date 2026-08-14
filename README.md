# arena

A 2D top-down arena survivor — you stand in a box, enemies walk at you in waves, your weapon
fires itself, and you live as long as you can. Built with **Phaser 4** and **TypeScript**.

It is also a deliberate architecture exercise. The game is built in three stages, and the
discipline of *not* building ahead of the current stage is the point. See
[`docs/STATUS.md`](docs/STATUS.md) for where the project stands right now.

```
┌──────────── the arena (1280 × 720) ────────────┐
│   ▪ ▪                                     ▪    │   ▪  enemies walk in from off-screen
│         ·                            ·         │   ·  XP gems dropped by the dead
│                    ▣  ← you                    │   ▣  you (WASD)
│           ·               ─ ─ ─ ─ ─ ▪          │   ─  auto-fired shots
│   ▪                                        ▪   │
└────────────────────────────────────────────────┘
```

## Quick start

Requires **Node 20.19+ or 22.12+** (a Vite 8 constraint).

```bash
npm install
npm run dev          # http://localhost:5173
```

WASD to move. You fire automatically at whatever is nearest. That's the whole control scheme.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run test` | Vitest |

The last four are the definition of done. A change is not finished until all four pass.

## Documentation

Read these in order depending on who you are.

| If you are… | Start here | Why |
|---|---|---|
| **New to game development** (but a working developer) | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) | Translates game-engine concepts into terms a web developer already has. Assumes you know TypeScript and npm, assumes you have never written a game loop. |
| **Wanting the current state and what's next** | [`docs/STATUS.md`](docs/STATUS.md) | The checkpoint. What works, what is deliberately missing, and every upgrade path with its cost. |
| **Ready to change code** | [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the parts fit and which file to touch for a given change. |
| **An AI agent picking up work** | [`docs/STATUS.md`](docs/STATUS.md) → [`AGENTS.md`](AGENTS.md) | STATUS tells you what to build; AGENTS tells you the rules that will get the work rejected if broken. |

Two more files exist and are worth knowing about: [`AGENTS.md`](AGENTS.md) is the authority on
stack, structure and architectural invariants — if any other document contradicts it, it wins.
[`CLAUDE.md`](CLAUDE.md) covers working conventions rather than the code.

## The shape of it

31 TypeScript files, ~2,100 lines, no art assets, no runtime dependency beyond Phaser and zod.

```
src/
├─ core/         portable TypeScript — zero Phaser imports, lint-enforced
├─ components/   reusable behaviour attached to entities (health, weapon, input)
├─ entities/     the things on screen (player, enemy, projectile, gem)
├─ systems/      per-frame logic across many entities
├─ scenes/       lifecycle and wiring
├─ constants/    every tunable number in the game
└─ data/         JSON content + its zod schemas
```

Each folder has exactly one job, and a file in the wrong folder is a bug even when it
compiles. [`docs/ONBOARDING.md`](docs/ONBOARDING.md) explains what each one means and why the
boundaries are drawn where they are.
