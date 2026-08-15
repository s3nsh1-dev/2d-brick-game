import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { addScrim } from '../ui/backdrop';
import { Button } from '../ui/Button';
import { Label, LabelVariant } from '../ui/Label';
import { Panel } from '../ui/Panel';

// A held breath. Like `UpgradeScene`, this layers over a *paused* GameScene rather than
// replacing it, so the arena stays on screen behind the sheet.
//
// It resumes the run itself for the same reason the upgrade menu does: GameScene is paused,
// so it cannot act on any signal telling it to wake up.
//
// It shows no run statistics, deliberately. GameScene lifts the HUD above this scene while
// it is open, so health, level and the list of upgrades taken are already on screen and
// undimmed — repeating them here would be two copies of one fact.

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

    addScrim(this);
    new Panel(this, width / 2, height / 2, 460, 220);

    new Label(this, width / 2, height / 2 - 66, 'PAUSED', LabelVariant.TITLE).setOrigin(0.5);

    new Button(this, width / 2, height / 2 + 12, BALANCE.ui.button.width, 'RESUME', this.resume);

    new Label(this, width / 2, height / 2 + 62, 'or press any key', LabelVariant.SMALL)
      .setOrigin(0.5);

    // `once`, so the keypress that resumes cannot also be read by the run it resumes into.
    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.resume);
  }
}
