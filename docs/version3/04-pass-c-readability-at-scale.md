# Pass C — readability and feel at scale

**The problem the brief named:** Stage 2's effects were built and verified against a handful of
enemies. At wave 8 there are 200, and every effect fires 200 times.

**What shipped:** enemies that tint toward damage, per-frame budgets on every visual effect,
damage numbers that stay legible, and three moments that finally feel different from each
other. The camera was left fixed, on purpose.

Commit: `feat(vfx): make the board readable at two hundred enemies`.

---

## Enemy health, without 200 health bars

The brief ruled out the obvious answer in advance: *"Not a health bar over every enemy — 200 of
them is unreadable and it is Pass D's problem immediately."*

The answer is a tint that moves toward red as an enemy loses health, computed in
`core/color.ts`:

```ts
damageTint(ratio, floor)   // full health → 0xffffff (no tint); dead → the floor
```

Three things make it work at scale:

- **It costs nothing.** `setTint` is a vertex colour, not a texture change and not a batch
  break. Two hundred tinted sprites are still two hundred sprites in the same batch.
- **It floors at 0.34** rather than going to full red. Below that the enemy starts losing its
  own identity colour, and type identity is more important than exact health.
- **It is a *multiply*.** That is the constraint that decides the whole design: `setTint` can
  darken a baked texture and can never brighten one. Damage can only ever move an enemy toward
  darker and redder — which is fine here, and became the reason Pass E had to *bake* a second
  palette rather than tint one.

A brute at 6× HP now reads as "this one has taken a beating" from across the arena, which is
the whole point: the player could always see the brute, but could never see that it was nearly
dead.

---

## Effect budgets: the frame is capped, the game is not

Invariant 13 already coalesced identical *sounds* in a window. Pass C applied the same
discipline to visuals, with the numbers in `balance.ts`:

```
burstsPerFrame: 6      sparksPerFrame: 10      textsPerFrame: 2
```

The critical property, and the reason this is presentation rather than gameplay:

> **The events still fire and the gameplay still resolves. Only the drawing is capped.**

Forty enemies dying in one frame is still forty deaths, forty gems and forty XP. It is six
bursts. If the cap had been applied to the *events*, the same code would have changed how much
damage things take, and it would have belonged to a different project.

**Player damage is exempt from the text budget.** It is the one number a player must never
miss, and it is bounded anyway by the per-enemy contact interval. An accessibility-shaped
argument applies to budgets too: capping an effect is fine, capping *information* is not.

---

## Damage numbers: aggregate, or fade fast?

The brief offered three options — aggregate, show only crits and player damage, or fade fast —
and asked for a decision, a comment, and a wave 8 to tune it against.

The decision was **cap the rate and fade fast**, not aggregate. Aggregation reads well in a
screenshot and badly in motion: a single `48` where four `12`s used to be is a number the
player has to interpret, and by the time they have, the enemies that produced it are dead.
Two numbers per frame, fading quickly, keep the *texture* of "damage is landing" without the
screen becoming a spreadsheet.

There are no crits in this game, so that option was never available — worth writing down,
because it is the kind of brief suggestion that reads as a requirement if nobody records why it
was skipped.

---

## The camera stays fixed, and that is a finding

The brief asked for a slight lead toward the pointer or the player's motion, and then, unusually,
pre-authorised the negative result:

> *"If the camera cannot move without breaking the arena framing, say so and leave it fixed.
> That is a legitimate finding, not a failed task."*

It cannot. **The arena is exactly the viewport** — 1280×720 of world, 1280×720 of camera. Any
pan at all moves the wall off one edge and reveals nothing but backdrop on the other. The wall
is the single element Pass A added to tell the player where the world stops, and a camera lead
would spend it for a feel improvement worth less than the framing it breaks.

Screen shake stays, because shake returns to centre.

The alternative — a world larger than the viewport — is a gameplay change and a different game.

---

## Death and level-up finally differ

They were both "some particles". They are now three distinguishable moments:

| Moment | What it looks like |
|---|---|
| **A hit** | A small spark burst at the contact point, in the spark colour |
| **A death** | A larger burst in the death colour, plus the enemy's own last tint |
| **A level-up** | The upgrade screen fades in *out of the accent colour* rather than out of black — a bloom, not a cut to a menu |

The level-up bloom is 260 ms — shorter than the scene transitions, because unlike them it lands
on a screen the player is already reading. It is the same `camera.fadeIn` the transitions use,
given the accent colour instead of the backdrop, which is the whole implementation.

---

## The pass that most wanted to become gameplay

The brief flagged this in advance and it was right. Three ideas were considered and refused,
all of them good game design and none of them Stage 3's:

- **Slow a nearly-dead enemy** so the tint has mechanical meaning. Changes where an entity ends
  up.
- **Let the budget drop the least important death**, e.g. skip a distant enemy's gem when the
  frame is busy. Changes what the player receives.
- **Flash the screen at low health.** This one is genuinely presentation, and it was still
  declined: it is a damage flash by another name, and Pass E would then owe it a toggle. It
  would have arrived one pass before the system that has to switch it off.
