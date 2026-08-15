// Every tunable number in the game. A number typed anywhere else is a bug.
//
// The split against `data/waves.json`: this file holds the grunt's *base* stats, the JSON
// holds the *escalation* applied to them per wave. Base stats are balance, escalation is
// content, and only content belongs in a data file.

/**
 * Every colour in the game, in one place. Invariant 17: a hex literal anywhere else is a bug
 * in the same way a magic number is.
 *
 * Declared as its own const rather than inline in `BALANCE` so the entries below can name a
 * colour by meaning — `backgroundColor: PALETTE.backdrop` — instead of repeating the number.
 * One definition per colour is what makes a theme variant an edit rather than a sweep.
 *
 * Enemy colours are the deliberate exception: they live in `data/enemies.json` because type
 * identity is content, and that file is frozen (invariant 16). What the palette owes them is
 * a floor they stay legible against, which is why every arena colour below is far darker
 * than any of the three.
 */
const PALETTE = {
  /** Behind everything: the canvas clear colour and the page around it. */
  backdrop: 0x0a0a11,
  /** The playable surface. Stage 2's flat world colour, now with an edge to belong to. */
  arenaFloor: 0x14141c,
  /** The lattice on the floor. Deliberately barely above the floor it sits on. */
  arenaGrid: 0x1d1d29,
  /** The wall. The one line that says where the world stops. */
  arenaEdge: 0x4c4c70,
  /** A lit band just inside the wall, so the boundary reads as depth rather than as a stroke. */
  arenaEdgeGlow: 0x252540,
  /** Corners darken toward this. It is what stops a flat rectangle reading as flat. */
  vignette: 0x04040a,

  playerBody: 0x6ce5b1,
  projectile: 0xf2e9a0,
  gem: 0x7fb2ff,

  uiText: 0xe8e8f0,
  uiDim: 0x9a9aae,
  uiAccent: 0x6ce5b1,
  uiPanel: 0x22222e,
  uiPanelHover: 0x2e2e3e,
  uiPanelEdge: 0x2a2a36,

  /** Damage taken, and anything the player should read as a threat. */
  danger: 0xff4d4d,
  /** A warning that is not yet damage: the spawn telegraph. */
  warning: 0xffc857,
  /**
   * The health pickup. Paler and brighter than the player's own mint so the two never read
   * as the same object, though the cross shape is what actually distinguishes it — every
   * other thing in this game is a square.
   */
  health: 0x9dffc6,

  /** Particles are baked white and tinted, so this is the one texture colour. */
  spark: 0xffffff,
  deathBurst: 0xe4645a,
  damageNumber: 0xffe9a8,
  playerDamageNumber: 0xff8a8a,
} as const;

export const BALANCE = {
  palette: PALETTE,

  world: {
    width: 1280,
    height: 720,
    backgroundColor: PALETTE.backdrop,
  },

  // The arena's own geometry. Every number here is drawn once into a texture at boot and
  // never touched again, so none of it costs anything per frame.
  arena: {
    /** Grid spacing. Large enough to read as a room rather than as graph paper. */
    gridCell: 64,
    gridLineWidth: 1,
    // Low on purpose. Every element behind the entities competes with them, and the enemies
    // must stay the highest-contrast thing on screen.
    gridAlpha: 0.6,
    edgeWidth: 3,
    /** How far the lit band reaches in from the wall. */
    edgeGlowWidth: 26,
    edgeGlowAlpha: 0.55,
    /** How far the corner darkening reaches in from each side. */
    vignetteDepth: 200,
    vignetteAlpha: 0.75,
  },

  time: {
    // Caps the frame delta so a backgrounded tab returning after several seconds steps the
    // simulation gently instead of teleporting bodies through each other.
    maxDeltaSeconds: 1 / 20,
  },

  player: {
    size: 22,
    color: PALETTE.playerBody,
    speed: 210,
    maxHp: 100,
  },

  weapon: {
    damage: 12,
    cooldownSeconds: 0.32,
    // Nothing is fired when the nearest enemy is further away than this.
    range: 360,
  },

  // Game feel that is not presentation. Both of these change where things end up or how
  // much time passes, which is why they live in CombatSystem and not in VfxSystem.
  combat: {
    knockback: {
      speed: 240,
      // Short: pursuit resumes almost immediately, so a swarm still closes in. Long enough
      // that a hit reads as a hit.
      durationSeconds: 0.11,
    },
    // The whole simulation stops for this long when an enemy dies. Deaths inside one frame
    // coalesce to a single freeze rather than summing, or a cleared wave would be a stutter.
    hitStopSeconds: 0.045,
  },

  projectile: {
    size: 6,
    color: PALETTE.projectile,
    speed: 480,
    lifetimeSeconds: 1.1,
    poolSize: 120,
  },

  // Size and colour are per-type and live in `data/enemies.json`; what remains here is the
  // unit enemy every definition is a multiple of.
  enemy: {
    baseHp: 20,
    baseSpeed: 62,
    contactDamage: 8,
    // A grunt sitting on the player deals its damage on this cadence rather than per frame.
    contactIntervalSeconds: 0.7,
    poolSize: 220,
  },

  gem: {
    size: 8,
    color: PALETTE.gem,
    value: 1,
    magnetRadius: 96,
    magnetSpeed: 340,
    poolSize: 220,
  },

  spawn: {
    // How far outside the world bounds enemies appear, so they walk in rather than pop in.
    ringMargin: 48,
  },

  // The one thing in the arena that helps rather than hurts. One per wave, from the wave
  // below, and it leaves if it is not taken — a lifeline you have to go and get is a
  // decision; one that waits forever is just delayed healing.
  healthPickup: {
    /** The first wave that produces one. Waves 1-5 give none. */
    firstWave: 6,
    /** How long after a wave starts it appears. Fixed, so the player learns the rhythm. */
    spawnDelaySeconds: 6,
    /** How long it waits before giving up. */
    lifetimeSeconds: 10,
    /** It blinks for this long at the end, so leaving is something you can see coming. */
    blinkSeconds: 3.5,
    blinkPerSecond: 5,
    healAmount: 25,
    size: 22,
    /** Arm thickness of the cross, as a fraction of `size`. */
    armRatio: 0.34,
    color: PALETTE.health,
    /** Keeps it off the wall, where it would be half hidden by the vignette. */
    edgeMargin: 96,
    /** Never close enough to be collected by standing still. */
    minPlayerDistance: 190,
    /** Two is already one more than can exist at once; the third is for a restart. */
    poolSize: 4,
  },

  progression: {
    // Gems are worth 1 apiece, so these are enemy counts: level 2 costs 5 kills, level 3
    // costs 8, and so on. Arithmetic rather than exponential — see core/xpCurve.ts.
    xp: {
      firstLevelCost: 5,
      costGrowth: 3,
    },
    /** Upgrades shown per level. The scene's layout assumes this many. */
    offerCount: 3,
  },

  // How the baked frames differ from the base square. There is no artwork to load, so an
  // animation is these numbers applied to the same solid fill the static texture uses.
  anim: {
    loopFrameRate: 8,
    hitFrameRate: 14,
    /** The walking frame's height, as a fraction of the resting frame. Reads as a bounce. */
    walkSquash: 0.84,
    /** The second idle frame's brightness. A slow pulse, not a flicker. */
    idleDim: 0.78,
    /** The hit frame is washed toward white by this much, 0 none and 1 fully white. */
    hitWhiten: 0.75,
  },

  audio: {
    // Well below CD rate on purpose: these are short percussive blips, nothing here has
    // content above ~8kHz, and halving the rate halves the buffers built at boot.
    sampleRate: 22050,
    masterVolume: 0.85,
    sfxVolume: 0.5,
    musicVolume: 0.28,
    /** Every rendered buffer is normalised to this peak, so no sound clips. */
    peak: 0.9,
    // Invariant 13: two of the same sound starting inside this window play once. Forty
    // enemies dying in one frame is one death sound.
    throttleSeconds: 0.05,

    sfx: {
      shoot: {
        durationSeconds: 0.07,
        startFrequency: 620,
        endFrequency: 380,
        waveform: 'square',
        attackSeconds: 0.002,
        decay: 22,
        gain: 0.5,
        noiseMix: 0.05,
      },
      enemyHit: {
        durationSeconds: 0.06,
        startFrequency: 300,
        endFrequency: 160,
        waveform: 'saw',
        attackSeconds: 0.001,
        decay: 26,
        gain: 0.45,
        noiseMix: 0.6,
      },
      enemyDeath: {
        durationSeconds: 0.18,
        startFrequency: 220,
        endFrequency: 70,
        waveform: 'triangle',
        attackSeconds: 0.002,
        decay: 12,
        gain: 0.6,
        noiseMix: 0.45,
      },
      playerDamage: {
        durationSeconds: 0.28,
        startFrequency: 180,
        endFrequency: 60,
        waveform: 'saw',
        attackSeconds: 0.003,
        decay: 8,
        gain: 0.75,
        noiseMix: 0.35,
      },
      pickup: {
        durationSeconds: 0.09,
        startFrequency: 720,
        endFrequency: 1180,
        waveform: 'sine',
        attackSeconds: 0.002,
        decay: 14,
        gain: 0.4,
        noiseMix: 0,
      },
      // Warm, rising and soft-edged. The gem blip is short and bright; this one has to read
      // as relief rather than as another gem, so it is slower and starts lower.
      heal: {
        durationSeconds: 0.34,
        startFrequency: 330,
        endFrequency: 660,
        waveform: 'triangle',
        attackSeconds: 0.012,
        decay: 6,
        gain: 0.55,
        noiseMix: 0,
      },
      // Longer and rising further than the pickup blip it has to be distinguishable from:
      // this one interrupts the run, so it should sound like an event rather than a tick.
      levelUp: {
        durationSeconds: 0.42,
        startFrequency: 440,
        endFrequency: 1320,
        waveform: 'square',
        attackSeconds: 0.004,
        decay: 5,
        gain: 0.5,
        noiseMix: 0,
      },
    },

    // Two voices over a sixteen-step loop, 2.56s long. Semitone offsets from the root;
    // null is a rest. Deliberately sparse — it plays under the whole run.
    music: {
      bass: {
        rootFrequency: 110,
        stepSeconds: 0.16,
        steps: [0, null, 0, null, -4, null, -4, null, -7, null, -7, null, -5, null, -5, null],
        waveform: 'triangle',
        decay: 5,
        gain: 0.55,
      },
      lead: {
        rootFrequency: 110,
        stepSeconds: 0.16,
        steps: [12, 19, 24, 19, 8, 15, 20, 15, 5, 12, 17, 12, 7, 14, 19, 14],
        waveform: 'square',
        decay: 9,
        gain: 0.16,
      },
    },
  },

  vfx: {
    /** The one texture every emitter draws, tinted per effect. */
    sparkSize: 4,

    /**
     * How much green and blue survive in an enemy tinted at zero health.
     *
     * The readable range is what this buys: a brute at 6× HP takes twenty hits, and without
     * it every one of those hits leaves an identical square. Low enough to read across a
     * crowd, high enough that a nearly-dead enemy is still clearly visible on a dark floor.
     */
    enemyDamageTintFloor: 0.34,

    /**
     * What one frame is allowed to draw. Stage 2's effects were built against a handful of
     * enemies; at wave 8 a single frame can contain forty deaths, and forty bursts is both
     * unreadable and expensive.
     *
     * The events still fire and the gameplay still resolves — only the drawing is capped,
     * which is why this belongs to presentation and changes no outcome.
     */
    budget: {
      burstsPerFrame: 6,
      sparksPerFrame: 10,
      /**
       * Damage numbers started per frame. Player damage is exempt: it is the one number the
       * player must never miss, and it fires at most once per contact interval anyway.
       */
      textsPerFrame: 2,
    },

    hitSpark: {
      count: 4,
      speedMin: 60,
      speedMax: 150,
      lifespanMs: 220,
      scaleStart: 1,
      scaleEnd: 0,
      color: PALETTE.projectile,
    },
    deathBurst: {
      count: 10,
      speedMin: 80,
      speedMax: 240,
      lifespanMs: 420,
      scaleStart: 1.4,
      scaleEnd: 0,
      color: PALETTE.deathBurst,
    },
    pickupSparkle: {
      count: 5,
      speedMin: 40,
      speedMax: 110,
      lifespanMs: 300,
      scaleStart: 0.9,
      scaleEnd: 0,
      color: PALETTE.gem,
    },
    // Bigger and slower than the gem sparkle. Taking a health pickup is a rarer and more
    // important moment than taking the hundredth gem, and should not look like one.
    healBurst: {
      count: 14,
      speedMin: 50,
      speedMax: 170,
      lifespanMs: 520,
      scaleStart: 1.5,
      scaleEnd: 0,
      color: PALETTE.health,
    },

    shake: {
      durationMs: 140,
      intensity: 0.006,
    },
    flash: {
      durationMs: 120,
      color: PALETTE.danger,
    },

    floatingText: {
      poolSize: 40,
      riseSpeed: 46,
      lifetimeSeconds: 0.65,
      fontSize: '16px',
      color: PALETTE.damageNumber,
      playerDamageColor: PALETTE.playerDamageNumber,
    },

    // The mark left on the wall where an enemy is about to walk in. An enemy crosses the
    // ring margin in `ringMargin / speed` seconds — roughly 0.8s for a grunt — so a marker
    // that outlives that is a warning the player had time to act on.
    spawnMarker: {
      poolSize: 32,
      /** Baked size of the bar. It lies along the wall it is drawn on. */
      width: 34,
      height: 4,
      lifetimeSeconds: 0.75,
      /** How far inside the wall the bar sits, so it never straddles the edge stroke. */
      inset: 12,
      color: PALETTE.warning,
      /** Starts stretched and settles, so the eye catches the change rather than the shape. */
      scaleStart: 1.6,
    },
  },

  ui: {
    margin: 18,
    /** Alpha of the sheet a paused run is dimmed by. Dims it; never hides it. */
    scrimAlpha: 0.84,

    font: {
      family: 'monospace',
      titleSize: '46px',
      headingSize: '24px',
      bodySize: '18px',
      smallSize: '14px',
    },

    panel: {
      borderWidth: 2,
      // Not quite opaque, so a panel over the arena still admits that the arena is there.
      fillAlpha: 0.94,
    },

    button: {
      height: 46,
      width: 260,
      gap: 14,
    },

    transition: {
      // Short on both sides. 200ms reads as a cut with weight; 400ms reads as waiting, and
      // the player pays it twice on every restart.
      inMs: 220,
      outMs: 200,
      /** The level-up bloom. Shorter still: it lands on a screen the player is reading. */
      bloomMs: 260,
    },

    hud: {
      barWidth: 260,
      barHeight: 16,
      /** Gap between the health bar and the experience bar under it. */
      rowGap: 26,
      /**
       * How fast the health bar catches up with the number, in bar-fractions per second.
       * A hit should read as a drain rather than as a jump, without lagging far enough
       * behind that the bar disagrees with the digits.
       */
      drainPerSecond: 0.9,
      /** How long the bar stays flushed red after a hit. */
      flashSeconds: 0.28,
    },

    upgradeList: {
      rowHeight: 18,
      /** Every upgrade in `upgrades.json` can be taken, so the list is never longer. */
      capacity: 6,
    },

    upgrade: {
      card: {
        width: 262,
        height: 196,
        gap: 34,
        padding: 16,
        borderWidth: 2,
      },
    },
  },

  debug: {
    physicsBodies: false,
    /**
     * Wave to open a run on. 1 is the shipped behaviour and changes nothing.
     *
     * It exists because invariant 20 requires a measurement, and the thing worth measuring —
     * two hundred enemies — is four minutes of play away. A number here makes that
     * measurement repeatable by whoever reads the figures next, rather than something that
     * needed a scratch patch and cannot be checked.
     */
    startWave: 1,
  },
} as const;
