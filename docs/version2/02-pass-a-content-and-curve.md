# 2. Pass A — content and curve

**Delivered:** `enemies.json` and its schema, `EnemyDefinition`, `Enemy` rebuilt to spawn from
a definition, swarmer and brute as **definitions rather than classes**, the enemy-id union
validated against the definitions file, and a ten-wave difficulty curve with a real fail state.

**The bar it had to clear:** adding a *fourth* enemy type must cost two JSON edits and no code.

---

## The architecture test

This pass was the real test of Stage 1's boundaries, and the brief said so up front. The
question: can a new enemy type be pure content?

The answer required distinguishing two things that sound identical:

- A new enemy **class** needs its own pool and its own physics group, which is a `GameScene`
  edit. Every time. That seam cannot be closed without a registry, and a registry for three
  types is exactly the speculative generality this project exists to avoid.
- A new enemy **definition**, served by the one `Enemy` class, needs no `GameScene` edit at all.

So the swarmer and the brute are rows in a JSON file. This directly contradicts the original
Stage 1 brief, which imagined "one entity file per enemy type" — and the definition of done
(two JSON edits) is only reachable on the definition route, so the DoD won.

### What the definitions look like

```json
{ "id": "swarmer", "size": 12, "color": "#f07ab4", "hpScale": 0.4, "speedScale": 1.9 }
```

Three decisions inside that one line:

**Multipliers, not absolute stats.** `hpScale` and `speedScale` multiply the base in
`balance.ts` rather than replacing it. A final stat is `base × definition × wave`. This keeps
`balance.ts` as the single place that says what an enemy *costs*, `enemies.json` as the place
that says how the types differ from each other, and `waves.json` as the place that says how both
escalate. The alternative — absolute HP in the definition — would have made
`BALANCE.enemy.baseHp` a dead number and left two files that both looked authoritative.

**Colour as a hex string, not a decimal integer.** JSON has no hex literal, so the honest
choices were `15033434` or `"#e4645a"`. Content is read by people. `PreloadScene` converts once
at bake time via `Phaser.Display.Color.HexStringToColor`.

There is a subtlety here that dictated the choice: the parsed data is stored in Phaser's
registry and **re-parsed** when read back. Had the schema used a zod `.transform()` to convert
the string to a number at parse time, the round-trip would fail — the second parse would find a
number where the schema expects `#rrggbb`. Keeping the stored shape identical to the file shape
makes re-validation idempotent.

**The `id` doubles as the texture key.** `PreloadScene` bakes a texture named `grunt`;
`Enemy.spawn` calls `setTexture(definition.id)`. Deriving a key like `` `enemy-${id}` `` would
allocate a string on every spawn — an allocation in a hot path, which invariant 6 forbids.

---

## The schema factory

The brief asked for `enemyIdSchema` to be "widened from a literal to a union validated against
`enemies.json`". A union over values that only exist at runtime cannot be a static schema, so
the wave schema became a **factory**:

```ts
export function makeWaveDataSchema(enemies: EnemyData) {
  const enemyIdSchema = z.enum(enemies.enemies.map((enemy) => enemy.id));
  // ...spawn entry, wave, wave data built around it
}
```

`PreloadScene` therefore parses enemies **first**, then builds the wave schema from the ids it
found. A wave naming an enemy that does not exist now fails at boot with the exact path and the
list of ids that would have worked:

```
ZodError: [{ "code": "invalid_value", "values": ["grunt","swarmer","brute"],
             "path": ["waves",2,"spawns",1,"enemy"],
             "message": "Invalid option: expected one of \"grunt\"|\"swarmer\"|\"brute\"" }]
```

That was verified by deliberately poisoning `waves.json` and reloading, not by reading the code.

**A typing detail worth stealing.** `enemies` is declared as a zod *tuple with a rest element*
rather than `z.array(...).nonempty()`:

```ts
enemies: z.tuple([enemyDefinitionSchema], enemyDefinitionSchema),
```

Both reject an empty list at runtime, but only the tuple spelling infers `[T, ...T[]]` in
TypeScript. That is what lets `GameScene` read `enemies[0]` without a guard against a case the
schema has already excluded — under `noUncheckedIndexedAccess`, the array spelling would have
forced an unreachable `if (first === undefined)` branch.

---

## The scene edits, reported rather than hidden

The brief predicted exactly one unavoidable scene edit. There were **two**.

**`PreloadScene` — predicted.** It baked four fixed textures; it now loops the definitions. A
one-time change, after which a fourth enemy needs no code.

**`GameScene` — not predicted.** `SpawnSystem` has to resolve `entry.enemy` into a definition,
and the only thing that can hand it the definitions is the scene that constructs it. That is
one extra constructor argument. The pooled `Enemy` also needs a real texture at construction —
before any wave has asked for a type — so the pool factory passes the first definition's id.
(A sprite constructed with a missing texture key draws Phaser's green placeholder and logs a
warning, which would have broken the empty-console requirement.)

Both are one-time; neither recurs when a fourth type is added, so the definition of done still
holds. The point of writing it down is that "the brief predicted one and reality needed two" is
information, and absorbing it silently would have destroyed it.

---

## The difficulty curve

The mandatory part of the pass, and the part that needed measurement rather than taste.

### The premise turned out to be wrong

The brief asserted that a stationary player "survived past wave 5 at full health". Before
tuning anything, that was tested: a Node model of the frame loop said a stationary player dies
in **wave 4**, and the real game agreed — dead in wave 4, having already lost 40 HP during
wave 3.

The conclusion still held (a five-wave table that plateaus is not a curve), so the work went
ahead as specified — but the recorded premise was corrected in the brief rather than left to
mislead the next reader.

### How it was tuned

Two tools, because the browser alone is too slow a feedback loop for balance work:

1. **A Node model of the frame loop** — spawn timeline, straight-line pursuit, nearest-target
   auto-fire with travel time, AABB overlap, per-enemy contact cooldowns. It reproduced the
   real game's wave-4 death, which is what made it trustworthy enough to tune against.
2. **A pressure budget** — the weapon's ceiling is 12 damage every 0.32 s = **37.5 dps**. A wave
   whose incoming HP-per-second exceeds that builds a backlog, and the backlog is what reaches
   the player. Printing incoming-HP/s, net-vs-37.5 and burst length per wave turned tuning from
   guesswork into arithmetic.

### The design problem, and the shape that solved it

The two targets pull against each other:

- A player who never moves **dies by wave 3**.
- A player who moves competently **dies somewhere in waves 5–8**.

A statue dies from *arrivals* — anything that reaches it stays on it. A moving player dies from
*saturation* — too many bodies to find a gap. But both are driven by the same quantity: incoming
HP/s versus 37.5. Sustained pressure high enough to kill a statue by wave 3 also saturated the
arena and killed the mover by wave 4.

The resolution was **pulses**. A spawn entry with a short interval and a modest count fires
early in the wave and then stops, because its count is exhausted — leaving a lull for the rest
of the wave.

- The burst briefly exceeds 37.5 dps → a queue builds → the queue reaches the statue → it dies.
- The lull lets a moving player clear the backlog they kited through.
- Later waves make the burst longer and denser until it is continuous, and the mover drowns too.

The other lever is **composition**: slow mass (grunts, brutes) punishes standing still and is
evadable by a mover, while swarmers are the pressure on a moving player. That is why swarmer
`speedScale` climbs late rather than early — a swarmer at 1.4× is 165 px/s against a player's
210, which is fast enough to cut corners on a kiter.

### The result

| Wave | Incoming HP/s | Net vs 37.5 dps | Mix |
|---|---|---|---|
| 1 | 13.3 | −24 | grunts only, gentle |
| 2 | 35.6 | −2 | grunts + first swarmers |
| 3 | 64.9 | **+27** | the burst that kills a statue |
| 5 | 60.6 | +23 | brutes soak, swarmers speed up |
| 7 | 89.3 | +52 | the mover starts bleeding |
| 10 | 289.9 | **+252** | roughly 7× the clear rate |

Measured outcomes: the stationary player dies in wave 3 on all five model seeds **and in the
real browser** (20 enemies alive at death). The kiting bot dies in waves 5–6 across five seeds.

**The honest caveat, recorded in `STATUS.md` as a known issue:** the moving-player target is
verified by a *bot*, not by a human playing. The stationary target was measured in the real
game and is solid; the 5–8 band is an estimate from a proxy.

---

## What this pass demonstrated

The Stage 1 boundaries held. Three enemy types, an entirely rebuilt difficulty curve, and a new
content file cost: one new JSON file, one widened schema, one entity signature, one system
lookup, and two one-time lines of scene wiring. No new class, no new abstraction, no registry.

---

**Next:** [Pass B — presentation](03-pass-b-presentation.md)
