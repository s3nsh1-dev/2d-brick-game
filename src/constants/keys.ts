// String keys Phaser addresses scenes, textures and registry entries by. Declared once so
// a typo becomes a compile error instead of a silently missing scene.

export const SceneKey = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MENU: 'Menu',
  GAME: 'Game',
  HUD: 'HUD',
  GAME_OVER: 'GameOver',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];

// Enemy textures are not named here. There is one per definition in `enemies.json` and the
// definition's own id is the key, so a new enemy type stays a content change.
export const TextureKey = {
  PLAYER: 'player',
  PROJECTILE: 'projectile',
  XP_GEM: 'xpGem',
} as const;

export type TextureKey = (typeof TextureKey)[keyof typeof TextureKey];

export const DataKey = {
  WAVES: 'waves',
  ENEMIES: 'enemies',
} as const;

export type DataKey = (typeof DataKey)[keyof typeof DataKey];
