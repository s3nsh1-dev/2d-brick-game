# Difficulties and fixes

Everything that went wrong in Stage 3, and what it cost. Two of the entries were not bugs at
all, which is its own lesson.

---

## Phaser traps

### `generateTexture` silently drops gradients

**Symptom:** the vignette and the edge glow rendered as flat bands. No warning, no exception.

**Cause:** `Graphics#generateTexture` renders through the **Canvas** API. `fillGradientStyle`
is WebGL-only, so the call is ignored rather than failing.

**Fix:** composite the arena into a `DynamicTexture`, which renders through WebGL. The rest of
the art pipeline still uses `generateTexture`, which is excellent at the solid fills it is
given.

**Cost:** an hour, and it was found by *looking at the screen* — nothing diagnostic pointed at
it. Rendering is verified by playing, and this is the concrete argument for that rule.

### `setTint` can only darken

**Symptom:** no combination of tints turns the red enemy into an orange one for the colourblind
palette.

**Cause:** `setTint` multiplies the texture's colour. Multiplying can darken and can never
brighten.

**Fix:** bake both palettes at boot and select the variant by texture key. Three extra
textures, and Pass D had already established that texture count costs nothing here.

**Where it bites elsewhere:** it is also why the damage tint floors at 0.34 rather than going
to white at full health, and why particles are baked white and tinted rather than baked
coloured.

### `setVolume` is not on `Phaser.Sound.BaseSound`

It exists on the concrete classes. Narrowed with `instanceof Phaser.Sound.WebAudioSound`
rather than a cast, because invariant 10 bans `any` and the narrow check is also more truthful.

---

## TypeScript and lint traps

### `as const` literal types, twice

`BALANCE` is `as const`, so `BALANCE.world.width` is not `number` — it is the literal `1280`.

**First bite, the linter:** `for (let x = 0; x < BALANCE.world.width; x += cell)` compares a
literal against a literal, which `no-unnecessary-condition` correctly calls a constant
condition. Fixed by annotating: `const width: number = BALANCE.world.width`.

**Second bite, the compiler:** the same shape appeared in `palette.test.ts` as **TS2677** on a
type predicate `(entry): entry is [string, number]`. A predicate cannot narrow to a type the
input already is. Fixed by narrowing in a plain loop instead of a filter with a predicate.

This trap was already in `STATUS.md` from an earlier stage. It bit twice more in Stage 3, in
two forms neither of which looked like the documented one. The entry has been rewritten to
cover the linter form as well.

---

## Design mistakes found by looking

None of these fail a test. All of them are visible.

| What was wrong | Why it happened | Fix |
|---|---|---|
| **The vignette cancelled the edge glow** | Drawn after it. Draw order is a correctness property in a composited texture, and nothing enforces it | Swap the order so the glow lands on top |
| **Game-over captions collided with their numbers** | `TITLE` is 46 px and centred; the caption offset was chosen by eye against a shorter label | More separation, checked in the rendered screen |
| **"nothing — the run ended early" on a victory** | An empty-state string that was correct when there was only one way for a run to end | The empty state depends on the `victory` flag |
| **The health pickup was buried under the crowd** | It sat at `Depth.PROJECTILE`. Visible in isolation; invisible at wave 8, which is the only situation where it matters | A new `Depth.HEALTH_PICKUP: 35`, between enemy and player |
| **"or press any key to begin" sat on the OPTIONS button** | The hint was placed by its own offset from the panel centre, which stopped being correct the moment a second button existed | Measured off the last button instead |

Every one of these was found in a screenshot. The pattern is worth naming: **a layout number
that is correct today is only correct for the layout it was written against**, and the fix is
usually to derive it from the thing it must not collide with.

---

## Two things that were not bugs

Both cost real time, and both are worth recording precisely because the conclusion was "nothing
is wrong here".

### The game appeared to play itself

**Symptom:** during verification, the player moved on its own and menu buttons activated with
no input from the session.

**Investigation:** instrumenting the page found hundreds of WASD `keydown` events and three
clicks arriving from outside the session — external input on a shared browser.

**Resolution:** not a game bug. The real lesson was methodological: *"no input" had been treated
as a controlled condition and it was not one.* Deterministic screens were captured afterwards
with temporary boot patches instead of by not touching the keyboard.

### Two console errors in "production"

**Symptom:** the console-message log showed two errors while checking the production build.

**Investigation:** both originated at `:5173` with `?t=` query parameters — dev-server
hot-reload states captured mid-edit, surfaced by asking for *all* messages since the start of
the session rather than since the last navigation.

**Resolution:** the production page at `:4173` was clean. The lesson is about the tool: a
console log that spans a session is not a console log for the page you are looking at.

---

## Where the brief was wrong, and where it was right

**Right, and worth saying:**

- It named the readability trap before Pass A and it was real: every element behind the
  entities competes with them.
- It pre-authorised two negative results — the camera and the atlas — and both came back
  negative. A brief that only defines success produces work that finds success.
- It predicted that `src/ui/` should be a new folder rather than part of `components/`, and the
  reasoning held up under the actual code.

**Wrong, or at least incomplete:**

- **It assumed `RenderTexture`/`generateTexture` would carry the arena.** They cannot carry a
  gradient. The advice about baking a static background once was right; the API named was not.
- **It offered "show only crits"** as a damage-number strategy. There are no crits in this game.
  A brief suggestion that assumes a mechanic which does not exist reads as a requirement to
  someone implementing it literally.
- **It contradicted itself on deployment** — §7 and §10 require a live URL, §6 (edited later)
  forbids deploying. The later instruction won; see [Pass F](08-pass-f-ship.md).

**And the one thing neither the brief nor the plan could have known:** the owner would play the
game halfway through the stage and change the scope. That produced [Pass G](05-pass-g-the-owners-addendum.md),
and the way it was handled — quarantined into its own pass and commit rather than blended in —
is the single decision in this stage most worth copying.
