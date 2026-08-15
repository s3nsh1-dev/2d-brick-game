# Pass A — visual identity and the arena

**The problem the brief named:** the game is squares on a void. There is no art direction to be
inconsistent *with*, which is why every later pass has nothing to anchor to.

**What shipped:** one palette every colour references, an arena with a floor, a grid, a lit
wall and a vignette, and a spawn telegraph. All of it baked into textures at boot; none of it
costs anything per frame.

Commit: `feat(scenes): give the arena a palette, a floor, an edge and a telegraph`.

---

## The palette came first, and that was the whole point

`PALETTE` is declared as its own `const` *above* `BALANCE`, not inline inside it. That is a
small thing with a large consequence: it lets every entry below name a colour by meaning.

```ts
world: { backgroundColor: PALETTE.backdrop }
```

rather than repeating `0x0a0a11` in four places and hoping they stay equal. One definition per
colour is exactly what made Pass E's colourblind variant an edit instead of a sweep — which was
the brief's argument for doing it, and it turned out to be true.

**The enemy colours are the deliberate exception.** They stay in `enemies.json`, because type
identity is content, and that file is frozen under invariant 16. What the palette owes them is
a floor they stay legible against, and that constraint is written into the comment above every
arena colour: each one is far darker than any of the three enemy colours. The background can
never win a contrast fight it was designed to lose.

**`index.html` is the second exception**, and it is unavoidable: the page has to paint a
background before any JavaScript runs, so the backdrop colour is repeated there. Both
exceptions are recorded in invariant 17 rather than left for someone to discover as a
violation.

---

## The arena is one texture, not a Graphics object

The brief warned about this in advance: *"a static background drawn once into a `RenderTexture`
costs one draw call; the same background rebuilt per frame in a `Graphics` object costs a great
deal more, and the difference is Pass D's problem if you get it wrong here."*

So the floor, the grid, the vignette, the lit edge band and the wall are all composited into a
**single** `DynamicTexture` in `PreloadScene`, and every scene that wants an arena background
adds one image. Pass D's measurement later confirmed the whole background costs one draw call.

### The trap: `generateTexture` is a Canvas renderer

This is the thing worth carrying to another project.

The rest of the art pipeline uses `Graphics#generateTexture`, which survives in Phaser 4 and is
excellent at solid fills. The vignette and the edge glow are gradients, so the first version
used the same call — and produced **flat bands with no gradient and no error**.

`generateTexture` renders through the **Canvas** API. `fillGradientStyle` is a WebGL-only
feature. The call is silently ignored: no warning, no exception, just a fill that is one colour
instead of four. A `DynamicTexture` renders through WebGL and keeps them.

The tell was visual, not diagnostic. Nothing in the console suggested a problem.

### `fillGradientStyle` takes corners, not a direction

There is no "fade downward" in the API. `fillGradientStyle(tl, tr, bl, br, aTl, aTr, aBl, aBr)`
takes four corner colours and four corner alphas, and a directional fade is expressed by which
corners get the strong alpha. `bakeInwardBand` wraps that with a `'up' | 'down' | 'left' |
'right'` argument so the four vignette edges and the four glow edges each read as one line
instead of eight numbers.

That helper exists because it has four callers each, twice. It is the kind of small wrapper
worth writing; a `GradientBuilder` class would not have been.

---

## Draw order is a correctness property

The vignette is drawn **before** the edge glow. In the first version it was drawn after, and it
cancelled the glow it was supposed to sit behind — the corners darkened the one element whose
job was to make the boundary read as depth.

Nothing catches this. It typechecks, it lints, it passes every test, and it is only visible by
looking at the rendered arena. It is a small argument for the rule that a rendering change is
verified by playing, not by asserting.

---

## The readability trap, checked rather than assumed

The brief is explicit: *"every element added behind the entities competes with them."* Three
choices came out of actually looking at a busy wave rather than out of taste:

- **The grid is `#1d1d29` on a `#14141c` floor at 0.6 alpha** — barely above the surface it sits
  on. It reads as a room rather than as graph paper, and at 200 enemies it disappears entirely,
  which is the correct behaviour.
- **The vignette reaches 200 px in from each side at 0.75 alpha.** Deep enough to shape the
  space, and it darkens the corners — where enemies enter — rather than the centre, where the
  player is.
- **The wall is 3 px with a 26 px lit band inside it.** The band is what makes the boundary read
  as depth instead of as a stroke around a rectangle. This is the "one technique, done well"
  the brief asked for; there is no parallax layer and no background gradient behind it.

---

## Spawn telegraphing

Enemies walk in from a ring outside the arena, so before Pass A the first thing a player knew
about an enemy behind them was the damage. A `SpawnMarker` — pooled, `dt`-ticked, in the
warning colour — appears at the arena edge where an enemy is about to enter.

Two design notes:

- **It reads the same events as everything else.** `SpawnSystem` emits `enemy:spawned`;
  `VfxSystem` subscribes. Gameplay does not know the marker exists, which is invariant 11 doing
  its job for a brand-new effect with no special case.
- **It is a warning, not a countdown.** It does not tell you how long you have, because a
  precise timer would be information the game does not otherwise give and would change how the
  wave is played. "I was told and did not look" was the goal; "I can time my dodge to the
  frame" was not.

---

## What was left alone

- **No parallax and no background gradient.** The brief asked for one depth technique done
  well. The vignette is it.
- **No arena obstacles.** They are on the never-built list, and they are also gameplay.
- **The enemy colours in `enemies.json`.** Frozen file, and the palette's job was to make them
  legible, not to replace them.
