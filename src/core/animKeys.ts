// The naming scheme for baked animation frames and the animations composed from them.
// Portable TypeScript: no Phaser, no DOM.
//
// This lives in core/ rather than constants/ because it is composition, not declaration, and
// constants/ is forbidden logic of any kind. The vocabulary — which states exist — is here
// too, so the scheme is readable in one file instead of two.
//
// There is no atlas. Every frame is its own baked texture, and an animation names the
// texture of each of its frames. `PreloadScene` bakes whatever these functions name, so an
// actor gaining a state is a change here and nowhere else.

/** The animation states every animated actor has. */
export const AnimState = {
  IDLE: 'idle',
  WALK: 'walk',
  HIT: 'hit',
} as const;

export type AnimState = (typeof AnimState)[keyof typeof AnimState];

/**
 * How many frames each state is baked at. Two is enough for a readable pulse and keeps the
 * texture count at four per actor; `hit` is a single held frame because it is a one-shot.
 */
export const ANIM_FRAME_COUNT: Readonly<Record<AnimState, number>> = {
  [AnimState.IDLE]: 2,
  [AnimState.WALK]: 2,
  [AnimState.HIT]: 1,
};

/**
 * The texture key of one baked frame.
 *
 * `actorId` is the player's key or an enemy definition's `id`, which is why a new enemy type
 * still needs no code: its frames are named from data it already carries.
 */
export function frameTextureKey(actorId: string, state: AnimState, frame: number): string {
  return `${actorId}__${state}__${String(frame)}`;
}

/** The key the animation itself is registered under with Phaser's global AnimationManager. */
export function animKey(actorId: string, state: AnimState): string {
  return `${actorId}__${state}`;
}

/**
 * The actor id an enemy's frames are baked under for the active palette.
 *
 * Two full sets of frames are baked at boot rather than one set re-tinted at runtime,
 * because `setTint` multiplies: it can only ever darken a baked colour, and the whole point
 * of the colourblind variant is to move colours somewhere the default palette cannot reach.
 * Frames are a few hundred bytes each; a second set costs nothing worth counting.
 */
export function paletteActorId(actorId: string, colourblind: boolean): string {
  return colourblind ? `${actorId}__cb` : actorId;
}
