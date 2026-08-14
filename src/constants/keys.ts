// String keys Phaser addresses scenes, textures and registry entries by. Declared once so
// a typo becomes a compile error instead of a silently missing scene.

export const SceneKey = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MENU: 'Menu',
  GAME: 'Game',
  HUD: 'HUD',
  GAME_OVER: 'GameOver',
  UPGRADE: 'Upgrade',
  PAUSE: 'Pause',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];

/**
 * Textures with exactly one frame and no animation.
 *
 * Animated actors are not named here. The player and every enemy definition own a set of
 * baked frames whose keys are built by `core/animKeys.ts` from an actor id — the player's
 * key below, or a definition's own `id` — so a new enemy type stays a content change.
 */
export const StaticTextureKey = {
  PROJECTILE: 'projectile',
  XP_GEM: 'xpGem',
  /** The particle sprite every emitter draws. One small square, tinted per effect. */
  SPARK: 'spark',
  /** The bar that marks where an enemy is about to enter. */
  SPAWN_MARKER: 'spawnMarker',
  /**
   * The whole arena — floor, grid, lit edge and vignette — composited once at boot.
   *
   * A DynamicTexture rather than a `generateTexture` bake: `generateTexture` goes through the
   * Canvas API, which drops the gradient fills the edge glow and vignette are made of. A
   * DynamicTexture renders through WebGL and keeps them. One texture, one draw call, and
   * nothing rebuilt per frame.
   */
  ARENA: 'arena',
} as const;

export type StaticTextureKey = (typeof StaticTextureKey)[keyof typeof StaticTextureKey];

/** The actor id the player's baked frames and animations are keyed under. */
export const PLAYER_ACTOR_ID = 'player';

/**
 * Cache keys the synthesised audio is decoded under.
 *
 * Prefixed, because these share Phaser's audio cache namespace with nothing today and that
 * is exactly when a collision is cheapest to prevent.
 */
export const SoundKey = {
  SHOOT: 'sfx.shoot',
  ENEMY_HIT: 'sfx.enemyHit',
  ENEMY_DEATH: 'sfx.enemyDeath',
  PLAYER_DAMAGE: 'sfx.playerDamage',
  PICKUP: 'sfx.pickup',
  LEVEL_UP: 'sfx.levelUp',
  MUSIC: 'music.loop',
} as const;

export type SoundKey = (typeof SoundKey)[keyof typeof SoundKey];

export const DataKey = {
  WAVES: 'waves',
  ENEMIES: 'enemies',
  UPGRADES: 'upgrades',
} as const;

export type DataKey = (typeof DataKey)[keyof typeof DataKey];
