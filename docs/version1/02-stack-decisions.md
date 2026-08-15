# 2. Stack decisions

Every dependency, why it was chosen, and what was given up. The versions were pinned in the
original brief ([`../KICKSTART.md`](../KICKSTART.md)) rather than discovered during
development, so these are largely *recorded* decisions rather than reconstructed ones.

The whole runtime dependency list is two packages:

```json
"dependencies": { "phaser": "^4.2.1", "zod": "^4.4.3" }
```

That is not minimalism for its own sake. Every dependency in a game is code that runs inside
your frame budget, and a small graph is a fast boot and a debuggable stack trace.

---

## Phaser 4 — the engine

**Chosen because** it is a batteries-included 2D engine for the web: renderer, scene manager,
input, audio, physics, texture cache and animation system in one package. For a first game, the
alternative — assembling five libraries and writing the glue — is a project about glue.

**Version 4 specifically, and this mattered more than expected.** Phaser 3 ended at 3.90 and v4
is a rewrite. The consequences ran through the whole project:

- `import * as Phaser from 'phaser'` — the default export was removed. `import Phaser from
  'phaser'` simply fails.
- The v3 WebGL pipeline system is gone, replaced by a node-based renderer.
- `Create.GenerateTexture` and `TextureManager.generate` were removed — but
  `Graphics#generateTexture` survives, which is the single API the entire art pipeline rests on.
- `Geom.Point` gave way to `Vector2`; `Math.TAU` changed meaning.

The practical hazard: **almost every tutorial, StackOverflow answer and AI-model recollection is
v3.** The mitigation was written into the project rules — `node_modules/phaser/skills/` ships
28 subsystem documents with the package, and `node_modules/phaser/types/` is ground truth.
"Check the shipped skill before writing against a subsystem" became a standing instruction, and
it repeatedly caught v3 habits before they became bugs.

**Alternatives, and why not:**

| Option | Why not |
|---|---|
| Plain Canvas 2D | You write the loop, the input, the texture handling, the collision and the scene lifecycle yourself. Educational, but it is three weekends before anything moves. |
| PixiJS | An excellent *renderer*, but only a renderer. You would still add physics, input, scenes and audio. |
| Excalibur / melonJS | Comparable and reasonable choices; smaller ecosystems and much less material to consult. |
| Unity / Godot | Not web-native, and the language and tooling lessons would not transfer to the rest of this developer's work. |

**What it cost:** a ~1.3 MB module graph with no useful split point. The production bundle is
~1.48 MB (388 kB gzipped), and Vite's default 500 kB chunk warning fires on it every build.
That is dealt with under Vite, below.

---

## TypeScript 5.9, `strict` and then some

**Chosen because** game state is mutable, shared and updated sixty times a second, which is
precisely the environment where a type error becomes a bug you cannot reproduce.

The compiler settings go past `strict`:

```jsonc
"strict": true,
"noUncheckedIndexedAccess": true,   // arr[i] is T | undefined
"exactOptionalPropertyTypes": true, // {a?: string} ≠ {a: string | undefined}
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"verbatimModuleSyntax": true,       // import type is not optional
```

`noUncheckedIndexedAccess` is the one that shapes the code most. Every array access in a system
returns `T | undefined` and must be handled, which is why loops over pools are full of
`if (item === undefined) continue;`. It is mildly tedious and it makes an entire class of
"undefined is not an object" crash impossible.

The rules layered on top: **no `any`, no `@ts-ignore`, no non-null assertion outside a
constructor.** `!` on a field assigned in `create()` is accepted as idiomatic — Phaser's scene
lifecycle genuinely assigns after construction — and everywhere else it needs a comment
justifying it.

*Reconstructed:* the payoff is visible in `Controls.ts`. Phaser's `addKeys()` returns a bare
`object`, which cannot be used under a no-`any` rule without a cast, so the code calls
`addKey()` four times instead and gets a typed `Key` each time. Three extra lines bought full
type safety — a small, characteristic example of the rule steering the design rather than being
worked around.

---

## Vite — dev server and build

**Chosen because** it is the fastest path from `npm run dev` to a running game with no
configuration, and its production build is a single `vite build`.

`vite.config.ts` contains exactly one setting, and the comment explains it:

```ts
build: {
  // Phaser is a single ~1.3MB module graph with no meaningful split point...
  chunkSizeWarningLimit: 2000,
}
```

**This is a decision worth understanding, not just a suppressed warning.** The project's
definition of done requires a build with zero warnings. Phaser cannot be code-split into
meaningful chunks — the game imports the engine and the engine is one graph. So the options
were: tolerate a permanent warning (which erodes the value of every other warning), or raise
the threshold deliberately with a comment saying why. The second was chosen.

**One consequence surprises web developers:** Vite full-page-reloads on every source change
instead of hot-swapping the module. This is correct and should not be "fixed". A Phaser game
holds its world, physics bodies, texture cache and scene instances in memory; patching a class
in place would leave a running game whose objects were built by the previous version of the
code. A full reload is the only coherent option, and it takes about a second.

---

## zod — runtime validation of game content

**Chosen because** the wave table is a JSON file, and a JSON file is untyped input no matter how
carefully you type the code that reads it.

The loading path is fixed:

```
PreloadScene → this.load.json() → schema.parse() → typed object into the registry
```

The important detail is `.parse()`, never `.safeParse()`, at boot. Malformed content should
take the boot sequence down loudly and immediately, naming the exact failing path, rather than
producing an empty wave seven minutes into a run. The failure mode of silent bad content is
hours of debugging; the failure mode of a loud crash is ten seconds.

*Reconstructed rationale for a second benefit:* the schema also became the place where Phaser's
untyped stores are contained. `Cache.get` and `DataManager.get` are both declared `any` in
Phaser's types, and an `any` at that boundary would spread through every caller. Widening to
`unknown` and running the schema costs nothing on a file this size and gives a typed result
with no cast anywhere else in the codebase — so the no-`any` rule survives contact with the
engine's own type declarations.

---

## Vitest — unit tests for the framework-free code

**Chosen because** it needs no configuration to run TypeScript, and because it is fast enough
that the whole suite runs in a fraction of a second.

The configuration carries the project's most load-bearing single line:

```ts
test: {
  // Node, not jsdom: src/core must be usable with no DOM at all.
  environment: 'node',
}
```

**This is what makes invariant 1 enforceable rather than aspirational.** `src/core/` is
supposed to be portable TypeScript with no Phaser and no DOM. Running its tests in a bare Node
environment means any accidental reach for `document`, `window` or Phaser fails the test run
immediately. The rule is checked by the test environment, not by reviewers remembering it.

**What is deliberately not tested:** scenes, systems and entities. They import Phaser and would
need either a real browser or a mountain of mocks, and mock-heavy tests of engine glue tend to
assert that the mocks were called rather than that the game works. Those layers are verified by
running the game. The trade is stated openly in `AGENTS.md` rather than hidden.

---

## ESLint flat config + typescript-eslint

**Chosen because** several of the architectural invariants are mechanically checkable, and a
rule that a machine checks is a rule that survives.

Beyond `strictTypeChecked` and `stylisticTypeChecked`, four project-specific rules:

```js
// Invariant 1, enforced rather than trusted
files: ['src/core/**/*.ts'],
rules: { 'no-restricted-imports': [/* ban 'phaser' and 'phaser/*' */] }
```

```js
'no-restricted-syntax': [{ selector: 'ExportDefaultDeclaration', /* named exports only */ }],
'@typescript-eslint/prefer-readonly': 'error',
'no-console': 'error',
```

The `core/` import ban is the notable one: it is the only invariant with a lint rule of its
own, because it is the one that everything else depends on. The comment in the config says so
in as many words.

`eslint . --max-warnings 0` — warnings are errors. A warning nobody must fix is noise that
trains you to ignore output.

---

## What was deliberately *not* added

Recorded so the absences read as decisions rather than gaps:

- **No state-management library.** The game state is the entities; a store would be a second
  copy of it.
- **No animation/tween library.** Everything is a number decremented by `dt`. Stage 2 kept this
  and it turned out to matter — see [version 2's notes on pausing](../version2/06-pass-e-persistence-and-flow.md).
- **No asset pipeline, no texture packer.** There are no assets.
- **No UI framework for the HUD.** The HUD is a Phaser scene drawing text and a rectangle.
  Putting React over a canvas game means two update models fighting over one frame.
- **No physics engine beyond Arcade.** Arcade Physics is axis-aligned boxes and nothing else,
  which is exactly enough for a game where everything is a square.

---

**Next:** [Architecture decisions](03-architecture-decisions.md)
