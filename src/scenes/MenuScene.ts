import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';

// Title card. Any key or click starts a run.

export class MenuScene extends Phaser.Scene {
  // An arrow field rather than a method: Phaser's `once` takes a context argument, but a
  // bound function is what makes that visible to the type system instead of implied.
  private readonly begin = (): void => {
    this.scene.start(SceneKey.GAME);
  };

  public constructor() {
    super(SceneKey.MENU);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { font } = BALANCE.ui;

    this.add
      .text(width / 2, height / 2 - 70, 'ARENA', {
        fontFamily: font.family,
        fontSize: font.titleSize,
        color: font.color,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 + 10, 'WASD to move. You fire on your own.', {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: font.color,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 + 60, 'press any key to begin', {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: font.dimColor,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.begin);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, this.begin);
  }
}
