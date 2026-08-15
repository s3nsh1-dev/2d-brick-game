// Render order. Gaps between values leave room to slot something in without renumbering.

export const Depth = {
  BACKGROUND: 0,
  GEM: 10,
  PROJECTILE: 20,
  ENEMY: 30,
  /**
   * Above the crowd, below the player.
   *
   * It is an object on the floor and by rights belongs under the things walking over it, but
   * at two hundred enemies a floor-level pickup is invisible exactly when it is most needed.
   * Readability wins; there is only ever one of these on screen.
   */
  HEALTH_PICKUP: 35,
  PLAYER: 40,
  // Above every entity so an effect is never hidden by the thing that caused it, and below
  // the HUD so it never obscures a number the player needs.
  PARTICLE: 50,
  FLOATING_TEXT: 60,
  /** The sheet that dims a paused run. Above the arena, below the screen laid over it. */
  SCRIM: 80,
  /** Panels and bars: the furniture UI text sits on. */
  PANEL: 90,
  UI: 100,
} as const;

export type Depth = (typeof Depth)[keyof typeof Depth];
