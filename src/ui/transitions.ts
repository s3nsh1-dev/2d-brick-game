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
