// Every tunable number in the game. A number typed anywhere else is a bug.
//
// The split against `data/waves.json`: this file holds the grunt's *base* stats, the JSON
// holds the *escalation* applied to them per wave. Base stats are balance, escalation is
// content, and only content belongs in a data file.

export const BALANCE = {
  world: {
    width: 1280,
    height: 720,
    backgroundColor: 0x14141c,
  },

  time: {
    // Caps the frame delta so a backgrounded tab returning after several seconds steps the
    // simulation gently instead of teleporting bodies through each other.
    maxDeltaSeconds: 1 / 20,
  },

  player: {
    size: 22,
    color: 0x6ce5b1,
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
    color: 0xf2e9a0,
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
    color: 0x7fb2ff,
    value: 1,
    magnetRadius: 96,
    magnetSpeed: 340,
    poolSize: 220,
  },

  spawn: {
    // How far outside the world bounds enemies appear, so they walk in rather than pop in.
    ringMargin: 48,
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

    hitSpark: {
      count: 4,
      speedMin: 60,
      speedMax: 150,
      lifespanMs: 220,
      scaleStart: 1,
      scaleEnd: 0,
      color: 0xf2e9a0,
    },
    deathBurst: {
      count: 10,
      speedMin: 80,
      speedMax: 240,
      lifespanMs: 420,
      scaleStart: 1.4,
      scaleEnd: 0,
      color: 0xe4645a,
    },
    pickupSparkle: {
      count: 5,
      speedMin: 40,
      speedMax: 110,
      lifespanMs: 300,
      scaleStart: 0.9,
      scaleEnd: 0,
      color: 0x7fb2ff,
    },

    shake: {
      durationMs: 140,
      intensity: 0.006,
    },
    flash: {
      durationMs: 120,
      color: 0xff4d4d,
    },

    floatingText: {
      poolSize: 40,
      riseSpeed: 46,
      lifetimeSeconds: 0.65,
      fontSize: '16px',
      color: '#ffe9a8',
      playerDamageColor: '#ff8a8a',
    },
  },

  ui: {
    margin: 18,
    hpBar: {
      width: 280,
      height: 18,
      backgroundColor: 0x2a2a36,
      fillColor: 0x6ce5b1,
    },
    font: {
      family: 'monospace',
      bodySize: '18px',
      titleSize: '46px',
      color: '#e8e8f0',
      dimColor: '#9a9aae',
    },

    upgrade: {
      /** Alpha of the sheet over the frozen run. Dims it; never hides it. */
      dim: 0.82,
      card: {
        width: 260,
        height: 190,
        gap: 34,
        backgroundColor: 0x22222e,
        hoverColor: 0x2e2e3e,
        borderColor: 0x6ce5b1,
        borderWidth: 2,
        accentColor: '#6ce5b1',
      },
    },
  },

  debug: {
    physicsBodies: false,
  },
} as const;
