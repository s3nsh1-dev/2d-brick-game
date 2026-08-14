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

  projectile: {
    size: 6,
    color: 0xf2e9a0,
    speed: 480,
    lifetimeSeconds: 1.1,
    poolSize: 120,
  },

  enemy: {
    size: 18,
    color: 0xe4645a,
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
  },

  debug: {
    physicsBodies: false,
  },
} as const;
