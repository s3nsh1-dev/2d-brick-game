import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';

// A held breath. Like `UpgradeScene`, this layers over a *paused* GameScene rather than
// replacing it, so the arena stays on screen behind the text.
//
// It resumes the run itself for the same reason the upgrade menu does: GameScene is paused,
// so it cannot act on any signal telling it to wake up.

export class PauseScene extends Phaser.Scene {
  private readonly resume = (): void => {
    this.scene.resume(SceneKey.GAME);
    this.scene.stop();
  };

  public constructor() {
    super(SceneKey.PAUSE);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { font } = BALANCE.ui;

    this.add
      .rectangle(0, 0, width, height, BALANCE.world.backgroundColor, BALANCE.ui.upgrade.dim)
      .setOrigin(0)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 - 24, 'PAUSED', {
        fontFamily: font.family,
        fontSize: font.titleSize,
        color: font.color,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 + 34, 'press any key to resume', {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: font.dimColor,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    // `once`, so the keypress that resumes cannot also be read by whatever comes next.
    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.resume);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, this.resume);
  }
}
