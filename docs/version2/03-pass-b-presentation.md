# 3. Pass B — presentation

**Delivered:** per-frame baked textures and idle/walk/hit animations, an `Animator` component,
six synthesised sound effects plus a music loop, three particle emitters, pooled floating damage
numbers, screen shake and damage flash.

**The bar it had to clear:** deleting `AudioSystem` and `VfxSystem` from the system array leaves
a fully playable, silent, unadorned game **with identical timing**.

**Still zero asset files.** Every frame is baked at boot; every sound is arithmetic.

---

## Two corrections the brief made to itself

Worth reading before the rest, because both changed what "done" meant. Both came from reading
the Phaser skills that ship with the package rather than from assumption.

### No packed atlas — bake one texture per frame

The original scope said "texture atlas". An atlas exists to prevent batch breaks across *many
separate source images*, and this project has no source images at all. Packing four generated
squares into a strip saves nothing measurable.

What made the alternative viable is a detail of Phaser's animation config: an animation's
`frames` array can name **its own texture key per frame**.

```ts
frames: [{ key: 'grunt__walk__0' }, { key: 'grunt__walk__1' }]
```

So an animation can be composed from separately baked textures with no atlas and no
spritesheet. `generateFrameNumbers` is for spritesheets and `generateFrameNames` is for atlases;
neither was needed.

**The deliverable was therefore the pipeline, not the pixels:** a boot-time loop that bakes N
frames per actor, a key scheme, `anims.create` calls composing them, and a component wrapping
playback.

### Do not hand-roll the audio unlock, and ship no audio files

The `audio-and-sound` skill is explicit: *"You do not need to handle unlocking manually."*
Phaser listens for input on `document.body` and resumes the `AudioContext` itself. An earlier
instruction to unlock explicitly in `MenuScene` was simply wrong and was deleted.

For the sounds themselves, the same principle as the textures: **synthesise at boot, ship
nothing.** `this.sound.decodeAudio(key, arrayBuffer)` accepts a buffer, and a WAV file is a
44-byte header in front of raw PCM — so the whole path is arithmetic.

Because it is arithmetic with no Phaser in it, it lives in `core/` and is unit tested. That is
a genuine, non-speculative use of the portability invariant rather than a stretch of it.

---

## The art pipeline

### The key scheme

`core/animKeys.ts` — portable, no Phaser — owns the vocabulary and the naming:

```ts
export const AnimState = { IDLE: 'idle', WALK: 'walk', HIT: 'hit' } as const;
export const ANIM_FRAME_COUNT = { idle: 2, walk: 2, hit: 1 };

frameTextureKey('grunt', 'walk', 1)   // → 'grunt__walk__1'
animKey('grunt', 'walk')              // → 'grunt__walk'
```

It sits in `core/` rather than `constants/` because it is *composition* — functions — and
`constants/` forbids logic of any kind. Keeping the vocabulary next to the naming means the
scheme is readable in one file instead of two.

The payoff: an actor id is either the player's constant or **an enemy definition's own `id`**,
so a new enemy type still needs no code. `PreloadScene` bakes whatever these functions name.

### What the frames actually are

Five textures per actor, all drawn on a canvas of the same size:

| Frame | How it differs |
|---|---|
| `idle__0` | the solid square |
| `idle__1` | channels multiplied by `idleDim` (0.78) — a slow pulse, not a flicker |
| `walk__0` | the solid square |
| `walk__1` | squashed to 84% height, **resting on the bottom edge** |
| `hit__0` | mixed 75% toward white — a flinch |

**Why every frame shares a canvas size**, even when the shape on it is smaller: an animation
frame that changes the texture's dimensions changes the sprite's display size with it, so the
walk bounce would read as the whole body pulsing rather than as a step. Bottom-aligning the
squashed shape is what makes it read as weight.

Twelve animations get registered (4 actors × 3 states) and 23 textures baked, all driven by the
contents of `enemies.json`.

**One config detail that is load-bearing:** the hit animation is created with `repeat: 0`.
`Animator.playOnce` chains the standing loop back on afterwards, and a chained animation only
starts when the one before it *completes* — an animation with `repeat: -1` never does.

### The `Animator` component

Small, and two decisions inside it:

**It remembers which loop the sprite should be sitting in**, so callers can say "walk" every
frame without restarting the animation every frame.

**A one-shot returns to the loop via Phaser's own `chain`, not an `animationcomplete`
listener.** A pooled sprite released mid-animation would leave a `once` listener that never
fires — a leak across a restart, which is precisely the bug class invariant 9 exists to prevent.

**`retarget(actorId)`** exists because pooled enemies are reused across types, and the frames a
brute plays are not the frames a swarmer plays.

---

## The audio pipeline

`core/audioSynth.ts` is pure buffer maths: oscillators, an envelope, a noise source, mixing,
normalisation, and a WAV writer. `AudioSystem` renders the set once at init and hands it to
Phaser's decoder.

Decisions worth recording:

**Deterministic noise.** `Math.random` is deliberately not used — a synthesised sound that
differs between runs cannot be asserted on. A 32-bit LCG seeded per sound is more than enough
entropy to sound like noise, and it makes the buffers reproducible in tests.

**Phase is accumulated, not recomputed.** For a swept tone, computing phase as
`frequency × time` sweeps at *twice* the requested rate, because the instantaneous frequency of
`(f₀ + (f₁−f₀)t)·t` is its derivative rather than the bracket. Accumulating `frequency /
sampleRate` per sample is correct. This is asserted by a test that counts zero crossings in the
tail of a sweep.

**Normalise after mixing, not before.** Two layers that each fit inside ±1 sum to something
that does not, and the clipping that follows sounds like a fault rather than a loud sound.

**Clamp before scaling to 16-bit.** A sample above 1.0 would wrap to a large negative integer —
a loud click rather than the quiet clip the caller expects.

**22,050 Hz.** Well below CD rate on purpose: these are short percussive blips with nothing
above ~8 kHz, and halving the rate halves the buffers built at boot.

**The cache is checked before re-synthesising.** Phaser's audio cache is global and outlives a
scene, so on the second run of a session every buffer is still there.

**Invariant 13 in practice:** each sound has a `cooldown` ticked in `update`, and playing while
it is positive is a no-op. Forty enemies dying in one frame plays one death sound. The window
is `BALANCE.audio.throttleSeconds` — 0.05 s.

---

## The effects

`VfxSystem` holds three emitters built **once**, in the constructor, and re-triggered at a
position:

```ts
this.hitSpark.explode(BALANCE.vfx.hitSpark.count, x, y);
```

**`frequency: -1` plus `emitting: false`.** The first puts the emitter in explode mode so it
never flows on its own; `emitting: false` alone would leave a flow emitter that any later
`start()` would run continuously.

**One white spark texture, tinted per effect.** Tinting a coloured texture multiplies, which
would make every effect a muddier version of whatever colour was baked in.

**Floating damage numbers are pooled and advanced by `tickLife`, not by a tween.** A tween per
hit is an allocation in the hot path. The pool is owned by `VfxSystem` rather than by
`GameScene`, because deleting that system must take its effects with it — which it cannot do if
the scene holds the pool.

**Randomness in the emitter configs is exempt** from Stage 3's seeding pass, and there is a
comment at the site saying so. Spark angles decide no gameplay outcome, and making them
deterministic would buy a property nobody can observe. Writing that down was explicitly
requested by the brief so the seeding pass does not waste a session deciding.

---

## Keeping gameplay out of it

Invariant 11 is enforced by where the code lives, and it is checkable two ways.

**Gameplay emits; presentation subscribes.** Four new events carry a position and an amount:
`enemy:damaged`, `player:damaged`, `weapon:fired`, `gem:collected`. Each is bounded by an
existing cooldown, which is what makes them safe on a bus whose `emit` allocates a
rest-argument array. The per-contact collision callbacks beside them remain direct calls.

**The grep test:**

```bash
grep -rn "sound\.\|cameras\.\|\.shake(\|\.flash(\|add\.particles" \
  src/entities/ src/components/ src/systems/CombatSystem.ts \
  src/systems/PickupSystem.ts src/systems/SpawnSystem.ts
# (empty)
```

### The one place the line was drawn deliberately

An entity animating **itself** is entity state, not a presentation service. `Enemy.takeDamage`
applies damage and plays its own hit frame:

```ts
public takeDamage(amount: number): void {
  this.health.damage(amount);
  this.animator.playOnce(AnimState.HIT);
}
```

The alternative would be `VfxSystem` reaching for the entity — but bus payloads are primitives,
so it has no reference to reach with, and giving it one would break invariant 1 through the
type graph. The rule as written is about *global* presentation services (sound, camera,
particles); an entity's own animation state stays with the entity. This is recorded in
invariant 11's own wording so the exception is not a matter of interpretation.

---

## What was verified, and how

Not by looking at it — the effects are 220–420 ms and a screenshot rarely catches them:

| Claim | Evidence |
|---|---|
| Frames and animations are data-driven | 23 textures, 12 animation keys read out of the live `AnimationManager` |
| Audio synthesises and decodes | all 6 buffers in the cache, music playing, `sound.locked` false — with no manual unlock |
| Emitters fire at configured counts | peak alive particles: hit 4, death 10, pickup 5 — matching `balance.ts` exactly |
| Damage numbers work | a live text object reading `"12"` at alpha 0.23, depth 60 |
| Animations play per type | a pooled enemy on `grunt__walk`, the stationary player on `player__idle` |

---

**Next:** [Pass C — game feel](04-pass-c-game-feel.md)
