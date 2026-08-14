import * as Phaser from 'phaser';
import type { Vec2 } from '../core/math';

// WASD input, reduced to a normalised direction.
//
// Phaser's `addKeys()` returns a bare `object`, which cannot be used under this project's
// no-`any` rule without a cast. `addKey()` returns a typed `Key`, so four calls buy full
// type safety for the cost of three extra lines.

export class Controls {
  private readonly up: Phaser.Input.Keyboard.Key;
  private readonly down: Phaser.Input.Keyboard.Key;
  private readonly left: Phaser.Input.Keyboard.Key;
  private readonly right: Phaser.Input.Keyboard.Key;

  public constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (keyboard === null) {
      throw new Error('Controls requires the keyboard plugin, which is not enabled.');
    }

    this.up = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.down = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.left = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.right = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
  }

  /** Writes the normalised movement direction into `out`. No input writes (0, 0). */
  public readDirection(out: Vec2): Vec2 {
    throw new Error('not implemented');
  }

  public destroy(): void {
    throw new Error('not implemented');
  }
}
