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

/** Phaser names per-key events by suffix. Declared once so a typo is a compile error. */
const RESUME_KEY = 'keydown-ESC';

export class PauseScene extends Phaser.Scene {
  private readonly openOptions = (): void => {
    this.scene.start(SceneKey.OPTIONS, { returnTo: SceneKey.PAUSE });
  };

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
    new Panel(this, width / 2, height / 2 + 4, 460, 300);

    new Label(this, width / 2, height / 2 - 84, 'PAUSED', LabelVariant.TITLE).setOrigin(0.5);

    const { button } = BALANCE.ui;
    new Button(this, width / 2, height / 2, button.width, 'RESUME', this.resume);
    new Button(this, width / 2, height / 2 + button.height + button.gap, button.width, 'OPTIONS', this.openOptions);

    new Label(this, width / 2, height / 2 + 104, 'escape resumes', LabelVariant.SMALL)
      .setOrigin(0.5);

    // Only Escape, not any key: this sheet now has buttons worth clicking, and a screen that
    // exits on every keystroke cannot also be navigated.
    this.input.keyboard?.once(RESUME_KEY, this.resume);
  }
}
