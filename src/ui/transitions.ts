import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import type { SceneKey } from '../constants/keys';

// Scene changes, which were hard cuts through Stage 2.
//
// Camera fades rather than tweens. A camera effect belongs to the scene's own camera and
// stops when the scene does, so it cannot outlive the thing it was animating — which is the
// property that lets this codebase keep its "no timer can fire behind a paused scene" rule
// (`ARCHITECTURE.md`, scene lifecycle) while still having transitions.
//
// Deliberately short. A transition the player sits through twice per run is worse than the
// cut it replaced.

/** Fades a scene up from the backdrop colour. Call at the end of `create`. */
export function fadeIn(scene: Phaser.Scene): void {
  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(BALANCE.palette.backdrop);
  scene.cameras.main.fadeIn(BALANCE.ui.transition.inMs, r, g, b);
}

/**
 * Blooms a scene up out of the accent colour instead of out of the dark.
 *
 * This is what makes a level-up feel like a different event from a kill. A kill is particles
 * and a freeze; taking damage is a red flash and a shake; a level is the screen going bright
 * for a moment. Three moments, three signatures, none of them borrowed from another.
 *
 * It belongs to the scene that opens rather than to `VfxSystem` because the run is paused the
 * instant a level lands, and a camera effect on a paused scene stops mid-effect and stays
 * there — a stuck accent wash over the whole arena until the player picks a card.
 */
export function bloomIn(scene: Phaser.Scene): void {
  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(BALANCE.palette.uiAccent);
  scene.cameras.main.fadeIn(BALANCE.ui.transition.bloomMs, r, g, b);
}

/**
 * Fades out, then starts `key`.
 *
 * Guarded against a second call while a fade is already running: the menu and the game-over
 * screen both start on "any key", and a player leaning on the keyboard would otherwise
 * queue up several scene starts.
 */
export function fadeToScene(scene: Phaser.Scene, key: SceneKey, data?: object): void {
  const camera = scene.cameras.main;
  if (camera.fadeEffect.isRunning) {
    return;
  }

  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(BALANCE.palette.backdrop);

  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(key, data);
  });
  camera.fadeOut(BALANCE.ui.transition.outMs, r, g, b);
}
