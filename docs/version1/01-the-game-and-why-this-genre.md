# 1. The game, and why this genre

## What `arena` is

A top-down survivor. You stand in a 1280×720 box. Enemies walk in from off-screen in waves and
move straight at you. Your weapon fires itself at whatever is nearest. Killing things drops XP
gems. You have 100 HP, enemies deal contact damage, and the run ends when you die.

```
┌──────────── the arena (1280 × 720) ────────────┐
│   ▪ ▪                                     ▪    │   ▪  enemies walk in from off-screen
│         ·                            ·         │   ·  XP gems dropped by the dead
│                    ▣  ← you                    │   ▣  you (WASD)
│           ·               ─ ─ ─ ─ ─ ▪          │   ─  auto-fired shots
│   ▪                                        ▪   │
└────────────────────────────────────────────────┘
```

The whole control scheme is WASD. There is no fire button, no aiming, no menu during play.

## Why everything is a coloured rectangle

Every visual in Stage 1 is a solid square generated at boot by drawing into a `Graphics` object
and calling `generateTexture`. The repo contains **no image files at all**.

This is a deliberate choice with several payoffs, and it is the single decision most worth
copying if you are building your first game:

**You cannot get stuck on art.** The most common way a first game dies is that its author
spends three weekends on a sprite sheet and never writes the collision code. A rectangle takes
zero weekends. The game is playable on day one and stays playable.

**Colour becomes a typed constant, not an asset pipeline.** `BALANCE.enemy.color` was
`0xe4645a`. Changing how the game looks was editing a number in the same file where you edit
how fast things move. No import, no loader, no cache, no 404.

**It forces the architecture to be about behaviour.** When a grunt and a brute are both squares,
the only thing that can distinguish them is their stats and their code. You find out
immediately whether your enemy abstraction is real or whether it was being carried by the art.

**The art pipeline still exists — it is just tiny.** `PreloadScene` bakes textures at boot,
which is the same shape as loading a spritesheet: a preload phase, a texture cache, sprites
referencing keys. When Stage 2 added animation frames, nothing structural had to change,
because the seam was already there. That is the difference between "no art" and "the simplest
possible art".

> **On the name.** The repository directory is `2d-brick-game` and the package is `arena`.
> "Brick" describes the art — everything on screen is a small solid block — rather than the
> genre. This is not Breakout; nothing bounces off anything.

## Why this genre is close to ideal for learning 2D game development

An auto-firing arena survivor is unusually well suited to being a first game, for reasons that
are worth spelling out because they are not obvious in advance.

### It exercises every core system, and no optional one

To finish it you must write: a game loop with delta time, input handling, movement, spawning,
collision detection, damage resolution, object lifetime management, a HUD, and scene
transitions. That is essentially the complete list of things every 2D game needs.

What it does *not* require is equally important: no camera scrolling, no tilemaps, no
pathfinding, no animation state machine, no dialogue, no inventory, no save system, no level
design. Each of those is a project in itself, and none is needed to make this genre fun.

### The hardest input problem is deleted

Aiming is the fiddliest part of an action game — mouse tracking, aim assist, twin-stick
handling, touch controls. Auto-fire removes it entirely. The weapon targets the nearest enemy
within range, which is fifteen lines of code and no input at all.

That single decision means a beginner spends their time on the loop rather than on making a
crosshair feel right.

### Difficulty has a natural, tunable dial

"More enemies, arriving faster, with more HP" is a difficulty curve you can express as a table
of numbers. Compare that with a platformer, where difficulty lives in hand-placed geometry and
every adjustment is level design.

This is why the wave table is JSON and why Stage 2's balance work could be done by measurement
rather than by feel — the entire difficulty of the game is a few dozen numbers.

### It produces the "many things at once" problem early

By wave 5 there are dozens of enemies, projectiles and gems alive simultaneously. That forces
the two lessons that separate game code from application code — **pooling** and **no allocation
in the hot path** — into the very first version, where they are cheap to learn.

A game with three entities on screen never teaches you this, and you find out at the worst
possible time.

### A run is 60–120 seconds

You can test a change end-to-end in about a minute, and a fatal balance mistake costs you a
minute to discover. Short feedback loops are worth more than almost any other property when you
are learning.

### It is honestly fun with rectangles

The genre's appeal is emergent — dodging a swarm is satisfying whatever the swarm is drawn as.
A puzzle game with placeholder art is unplayable; this is not. That means you can evaluate
whether your *game* works long before you evaluate whether your *art* works.

## What it is bad at teaching

Being fair about the gaps, so you know what to build second:

- **No camera work.** The arena is exactly one screen, so scrolling, following, parallax and
  culling never come up.
- **No level or tile data.** There is no world to author, no tilemap, no collision geometry
  beyond "the walls of the box".
- **Trivial AI.** Enemies move in a straight line toward the player. Real pathfinding is a
  different discipline and this genre never asks for it.
- **No animation-heavy design.** Stage 2 added a two-frame walk cycle; nothing here needs an
  animation state machine with blending and transitions.

If you build this and want the natural next step, a game with a scrolling camera and a tilemap
covers most of what this one skips.

---

**Next:** [Stack decisions](02-stack-decisions.md)
