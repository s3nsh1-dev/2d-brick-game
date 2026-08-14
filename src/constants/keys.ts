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

export const TextureKey = {
  PLAYER: 'player',
  ENEMY: 'enemy',
  PROJECTILE: 'projectile',
  XP_GEM: 'xpGem',
} as const;

export type TextureKey = (typeof TextureKey)[keyof typeof TextureKey];

export const DataKey = {
  WAVES: 'waves',
} as const;

export type DataKey = (typeof DataKey)[keyof typeof DataKey];
