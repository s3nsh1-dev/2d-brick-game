// Render order. Gaps between values leave room to slot something in without renumbering.

export const Depth = {
  BACKGROUND: 0,
  GEM: 10,
  PROJECTILE: 20,
  ENEMY: 30,
  PLAYER: 40,
  UI: 100,
} as const;

export type Depth = (typeof Depth)[keyof typeof Depth];
