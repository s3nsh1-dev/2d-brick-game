import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { EMPTY_SAVE, type SaveData } from '../core/SaveStore';
import { saveStore } from '../platform/storage';
import { addArenaBackdrop } from '../ui/backdrop';
import { Button } from '../ui/Button';
import { Label, LabelVariant } from '../ui/Label';
import { Panel } from '../ui/Panel';
import { fadeIn, fadeToScene } from '../ui/transitions';

// Title card. It stands on the same arena the run is played on, which is most of what makes
// the menu and the game read as one product rather than two screens sharing a font.
//
// It also reports the records, because a title screen that knows nothing about you is the
// least interesting screen a game can open with.

export class MenuScene extends Phaser.Scene {
  private records: SaveData = EMPTY_SAVE;

  private readonly begin = (): void => {
    fadeToScene(this, SceneKey.GAME);
  };

  private readonly openOptions = (): void => {
    this.scene.start(SceneKey.OPTIONS, { returnTo: SceneKey.MENU });
  };

  public constructor() {
    super(SceneKey.MENU);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { button } = BALANCE.ui;

    this.records = saveStore.load();

    addArenaBackdrop(this);

    new Panel(this, width / 2, height / 2 - 8, 580, 380);

    new Label(this, width / 2, height / 2 - 136, 'ARENA', LabelVariant.TITLE).setOrigin(0.5);
    new Label(this, width / 2, height / 2 - 82, 'survive every wave', LabelVariant.ACCENT)
      .setOrigin(0.5);

    new Label(
      this,
      width / 2,
      height / 2 - 32,
      'WASD to move.  You fire on your own.',
      LabelVariant.BODY,
    ).setOrigin(0.5);
    new Label(this, width / 2, height / 2 - 2, 'ESC pauses.', LabelVariant.DIM).setOrigin(0.5);

    new Button(this, width / 2, height / 2 + 48, button.width, 'BEGIN', this.begin);
    new Button(this, width / 2, height / 2 + 48 + button.height + button.gap, button.width, 'OPTIONS', this.openOptions);

    new Label(this, width / 2, height / 2 + 130, 'or press any key to begin', LabelVariant.SMALL)
      .setOrigin(0.5);

    this.showRecords();

    // `once`, so the keypress that starts a run cannot also be read by the run itself.
    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.begin);

    fadeIn(this);
  }

  /** Nothing at all on a first run, rather than three zeroes pretending to be a history. */
  private showRecords(): void {
    if (this.records.totalRuns === 0) {
      return;
    }

    const { width, height } = BALANCE.world;
    const summary =
      `best wave ${String(this.records.bestWave)}` +
      `   ·   high score ${String(this.records.highScoreXp)} xp` +
      `   ·   ${String(this.records.totalRuns)} runs`;

    new Label(this, width / 2, height - 54, summary, LabelVariant.SMALL).setOrigin(0.5);
  }
}
