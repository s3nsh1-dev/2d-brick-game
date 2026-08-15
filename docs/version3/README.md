# Version 3 — Stage 3: refinement and ship

**What this folder is:** the development history of Stage 3 — the six passes and the one
addendum, what each delivered, the decisions made inside them, and the places where the plan
and reality disagreed.

**What this folder is not:** the brief, and not a technical reference.

| For | Read |
|---|---|
| The brief Stage 3 was built against | [`../STAGE_3_instructions.md`](../STAGE_3_instructions.md) |
| How the code fits together today | [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) |
| The invariants, including 16–20 which Stage 3 added | [`../../AGENTS.md`](../../AGENTS.md) |
| Where the project stands | [`../STATUS.md`](../STATUS.md) |
| Stage 1 and 2's history | [`../version1/`](../version1/README.md), [`../version2/`](../version2/README.md) |

---

## The pages

| # | Page | What it covers |
|---|---|---|
| 1 | [What Stage 3 proved](01-what-stage-3-proved.md) | The goal, the pass order, and the one decision that shaped the whole stage |
| 2 | [Pass A — identity and the arena](02-pass-a-identity-and-arena.md) | One palette, a floor with an edge, and the Phaser trap that forced a rewrite |
| 3 | [Pass B — the UI kit and every scene](03-pass-b-ui-kit-and-scenes.md) | `src/ui/`, camera fades, and a HUD that had to learn things without being told |
| 4 | [Pass C — readability at scale](04-pass-c-readability-at-scale.md) | Damage tinting, per-frame effect budgets, and the pass that most wanted to become gameplay |
| 5 | [Pass G — the owner's addendum](05-pass-g-the-owners-addendum.md) | Five more waves, a victory, a health pickup — and why they were quarantined |
| 6 | [Pass D — performance, measured](06-pass-d-performance-measured.md) | The most valuable pass in the stage, which changed no code |
| 7 | [Pass E — options and accessibility](07-pass-e-options-and-accessibility.md) | A reversed decision, the first real use of the migration path, and a palette you can test |
| 8 | [Pass F — ship](08-pass-f-ship.md) | The page around the game, and what "ship" turned out to mean |
| 9 | [Difficulties and fixes](09-difficulties-and-fixes.md) | Everything that went wrong, including two things that were not bugs at all |
| — | [Deployment runbook](deployment.md) | How to put it online, per host, and what to check afterwards |

There is deliberately **no `post-ship-notes.md`.** The suggested shape for this folder proposed
one, for "what real players hit that no amount of self-testing surfaced". The game is not
hosted, so there are no real players and there is nothing honest to write. An empty page
promising future content is the documentation version of a stub.

---

## What Stage 3 added

| | Stage 2 | Stage 3 |
|---|---|---|
| Colours | hex literals in `balance.ts`, scenes and JSON | one `PALETTE`, referenced by meaning; a hex literal elsewhere is a lint-level bug |
| The arena | a flat `#14141c` rectangle | floor, grid, lit wall and vignette, composited into **one** texture at boot |
| Scenes | 8, all monospace text at three sizes on the same flat background | 9, all composed from a widget kit, visually one product |
| Scene changes | hard cuts | camera fades, 200–220 ms, both directions |
| The HUD | a rectangle and two labels that never reacted | draining health with digits, XP toward the next level, wave `n / 15`, live level, upgrade tally |
| Enemy health | invisible until death | tinted toward damage, readable at 200 enemies |
| Effects at scale | 40 deaths ⇒ 40 bursts | per-frame budgets on bursts, sparks and damage numbers |
| Options | three volume fields with **no UI able to reach them** | a scene, reachable from menu and pause, everything persisted |
| Accessibility | none | reduced motion, and a colourblind palette that separates on luminance |
| Waves | 10, holding on the last | 15, with a victory |
| Performance | a budget nobody had verified since Stage 1 | measured: 59.9 fps at 220 enemies, and three optimisations declined on the evidence |
| The page | `<title>arena</title>`, an empty favicon | metadata, Open Graph, inline-SVG favicon, loading state, error boundary |
| Tests | 127 across 9 files | 153 across 11 files |
| Runtime dependencies | `phaser`, `zod` | `phaser`, `zod` |

That last row again. Three stages, and the dependency list has never changed — because the art
is generated, the audio is arithmetic, and the UI kit is six small classes.

---

## Verification at the close of the stage

```
typecheck ✅   lint ✅ 0 warnings   test ✅ 153 passed / 11 files   build ✅ 0 warnings
production console ✅ empty
```

Measured in the running game rather than asserted:

- **59.9 fps mean** over 7,959 frames with up to 220 enemies alive; worst frame **17.6 ms**;
  heap **−8.5 MB** over 133 s. Production build, not the dev server.
- **6.4 draw calls per frame** at 220 sprites — which is why there is no texture atlas.
- A **v2 save migrated to v3** in a real browser, arriving with every accessibility option off.
- The colourblind enemy colours separate at relative luminance **0.53 / 0.90 / 0.16**, asserted
  in a unit test rather than eyeballed.
- The game scales correctly at a small laptop viewport (1280×720 `Scale.FIT` + `CENTER_BOTH`).

And the mechanical evidence that invariant 16 held, which matters more than any of the above:

```
git diff <stage-2> --stat -- src/data/enemies.json src/data/upgrades.json   # empty
git diff <stage-2> --stat -- src/data/waves.json                            # 40 insertions, 0 deletions
```

Every deletion in `balance.ts` across passes A–F is a colour or a UI dimension. Not one
gameplay number changed. The 40 insertions in `waves.json` are Pass G, which is the owner's
scope change, committed separately and on purpose — see
[page 5](05-pass-g-the-owners-addendum.md).
