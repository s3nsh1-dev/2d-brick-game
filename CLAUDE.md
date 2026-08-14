# CLAUDE.md

**Read `AGENTS.md` first. It is the source of truth for stack, structure, and architectural invariants.** This file does not repeat it — it covers how you and I work together in this repo.

## The one rule that matters most

This project is staged on purpose. `ARCHITECTURE.md` names the current stage. Building anything from a later stage is the failure mode I care about more than any bug.

That includes the subtle version: adding an `upgrades?: Upgrade[]` field "so Stage 2 is easier", leaving a `// TODO: particles here` hook, or generalising a class to handle a case that does not exist yet. If it is not in the current stage's scope, it does not appear in the diff. Speculative generality is the thing this exercise is designed to teach me to avoid — do not hand it to me.

If you think the current design genuinely blocks a later stage, say so in prose before you write code. Do not pre-solve it.

## Session workflow

**1. Orient.** Read `ARCHITECTURE.md` for the current stage, then the files you intend to change. Do not plan against remembered file contents from an earlier session.

**2. Plan.** For anything touching more than two files, write the plan first: files to change, the invariant each change respects, and what could break. Wait for my confirmation. For a one-file fix, skip the plan and just do it — asking permission for trivia wastes both our time.

**3. Implement.** Smallest coherent unit. One system, one entity, one bug.

**4. Verify.** Every time, in this order:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Do not report a task complete until all four pass. If you cannot run them, say that explicitly rather than assuming.

**5. Report.** Files changed with a one-line reason each, the verification output, and anything you noticed but deliberately left alone.

## Phaser 4 specifically

You have far more Phaser 3 than Phaser 4 in your training data, and v4 is a rewrite. Assume your recall is stale.

- Read `node_modules/phaser/skills/` for the subsystem you are touching before you write the code. The package ships these for exactly this purpose.
- `node_modules/phaser/types/` is ground truth when a skill and your memory disagree.
- Confidently writing a v3 API that no longer exists is worse than saying "let me check the types first". Check first.

## Stop and ask when

- A task seems to require breaking an invariant in `AGENTS.md`.
- A new dependency looks necessary.
- The right answer is a refactor larger than the task I described.
- Two reasonable designs exist and the choice is architectural rather than mechanical.
- You are about to guess at a Phaser 4 API you cannot verify locally.

Ask once, concisely, with your recommendation and the reason. Do not present a menu of five options for me to arbitrate.

## Do not

- **Do not agree with me when I am wrong.** If I ask for something that breaks an invariant, contradicts a decision recorded in `ARCHITECTURE.md`, or is just a bad idea, say so directly and explain why. I would rather be corrected than accommodated. Push back first, then do it if I still want it.
- **Do not claim something works if you have not run it.** "This should work" and "typecheck passes" are different sentences. Use the accurate one.
- **Do not silently fix unrelated things you notice.** Report them; leave them.
- **Do not summarise the code back to me.** I read TypeScript. Explain decisions and trade-offs, not syntax.
- **Do not pad responses.** No preamble, no "Great question", no recap of what I just asked for.

## Commits

Conventional commits, scoped to the folder:

```
feat(systems): add wave escalation to SpawnSystem
fix(core): ObjectPool.release no longer double-frees on rapid death
refactor(entities): extract Health out of Enemy
chore(deps): pin phaser to 4.2.1
docs(architecture): record Stage 1 completion
```

One logical change per commit. Never mix a refactor with a behaviour change.

## Keeping docs true

When a change alters architecture, update `ARCHITECTURE.md` in the same commit. When a change establishes a new convention, add it to `AGENTS.md` — not here. This file is about our working relationship; `AGENTS.md` is about the code.

Stale architecture docs are worse than none, because I will trust them.
