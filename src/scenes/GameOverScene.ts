import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { SceneKey } from '../constants/keys';
import { EMPTY_SAVE, type SaveData } from '../core/SaveStore';
import { levelForXp } from '../core/xpCurve';
import { getUpgradeData } from '../data/schema';
import { saveStore } from '../platform/storage';
import { addArenaBackdrop } from '../ui/backdrop';
import { Button } from '../ui/Button';
import { Label, LabelVariant } from '../ui/Label';
import { Panel } from '../ui/Panel';
import { fadeIn, fadeToScene } from '../ui/transitions';
import { UpgradeList } from '../ui/UpgradeList';

export interface GameOverData {
  readonly waveReached: number;
  readonly xpTotal: number;
  /** Every upgrade the run took, in the order taken. Collected by `GameScene`. */
  readonly upgrades: readonly string[];
  /** True when the player cleared the final wave rather than being cleared by it. */
  readonly victory: boolean;
}

// End of run. Receives the run's own numbers through scene data rather than the bus, because
// by the time it exists the bus has been cleared and the run it is reporting on is gone.
//
// It is also where a run is folded into the permanent record. That belongs here rather than
// in GameScene because this is the moment the run is definitively over.
//
// The level is not carried in the payload: it is `levelForXp` of the XP total, the same pure
// function the HUD and `ProgressionSystem` read it through. A number that can be derived
// exactly should not also be transported, or the two copies can disagree.
//
// `Phaser.Scene` does not declare `init`, so typing the payload here needs no cast and no
// `override` — the engine calls whatever `init` it finds.

export class GameOverScene extends Phaser.Scene {
  private waveReached = 0;
  private xpTotal = 0;
  private upgrades: readonly string[] = [];
  private victory = false;

  private records: SaveData = EMPTY_SAVE;
  private previous: SaveData = EMPTY_SAVE;

  private readonly restart = (): void => {
    fadeToScene(this, SceneKey.GAME);
  };

  public constructor() {
    super(SceneKey.GAME_OVER);
  }

  public init(data: GameOverData): void {
    this.waveReached = data.waveReached;
    this.xpTotal = data.xpTotal;
    this.upgrades = data.upgrades;
    this.victory = data.victory;

    // Read before writing: `recordRun` returns the *merged* record, which cannot answer
    // "did this run beat the last one?" — the only question worth putting on this screen.
    this.previous = saveStore.load();
    this.records = saveStore.recordRun(data.waveReached, data.xpTotal);
  }

  public create(): void {
    const { width, height } = BALANCE.world;

    addArenaBackdrop(this);

    // The panel's own bottom edge, so the button below can be placed against it rather than at
    // an offset that happened to look right. At 428 tall the button finished 5px short of the
    // border and read as clipped.
    const panelCentreY = height / 2 + 6;
    const panelHeight = 452;
    const panelBottom = panelCentreY + panelHeight / 2;

    new Panel(this, width / 2, panelCentreY, 620, panelHeight);

    // The two endings should not share a screen that only differs in one word. Clearing the
    // arena is the whole point of the game, and it says so.
    new Label(
      this,
      width / 2,
      height / 2 - 172,
      this.victory ? 'ARENA CLEARED' : 'RUN OVER',
      LabelVariant.TITLE,
    )
      .setOrigin(0.5)
      .setVariantColor(this.victory ? BALANCE.palette.uiAccent : BALANCE.palette.uiText);

    if (this.victory) {
      new Label(this, width / 2, height / 2 - 134, 'every wave survived', LabelVariant.DIM)
        .setOrigin(0.5);
    }

    // The victory subtitle is inserted into a gap the death screen leaves empty, so the block
    // beneath it moves down to keep it from crowding the captions. There is slack below: the
    // numbers clear the personal-best banner either way.
    this.showRun(this.victory ? 14 : 0);
    this.showPersonalBest();
    this.showUpgrades();

    const { button, margin } = BALANCE.ui;
    const buttonY = panelBottom - margin - button.height / 2;

    new Label(
      this,
      width / 2,
      buttonY - button.height / 2 - margin,
      `best wave ${String(this.records.bestWave)}` +
        `   ·   high score ${String(this.records.highScoreXp)} xp` +
        `   ·   ${String(this.records.totalRuns)} runs`,
      LabelVariant.SMALL,
    ).setOrigin(0.5);

    new Button(this, width / 2, buttonY, button.width, 'RUN AGAIN', this.restart);
    new Label(this, width / 2, height - 42, 'or press any key', LabelVariant.SMALL).setOrigin(0.5);

    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.restart);

    fadeIn(this);
  }

  /** The three numbers the run produced, as headings rather than a sentence. */
  private showRun(offsetY: number): void {
    const { width, height } = BALANCE.world;
    const level = levelForXp(this.xpTotal, BALANCE.progression.xp);

    const columns: readonly (readonly [string, string])[] = [
      ['WAVE', String(this.waveReached)],
      ['LEVEL', String(level)],
      ['XP', String(this.xpTotal)],
    ];

    const spacing = 180;
    const left = width / 2 - (spacing * (columns.length - 1)) / 2;

    for (const [index, [caption, value]] of columns.entries()) {
      const x = left + spacing * index;
      // The caption clears the digits below it: a TITLE label is 46px tall and centred, so
      // anything inside ~26px of it collides with the number rather than labelling it.
      new Label(this, x, height / 2 - 116 + offsetY, caption, LabelVariant.SMALL).setOrigin(0.5);
      new Label(this, x, height / 2 - 80 + offsetY, value, LabelVariant.TITLE).setOrigin(0.5);
    }
  }

  /** Unmissable when it happens, and completely absent when it does not. */
  private showPersonalBest(): void {
    const { width, height } = BALANCE.world;
    const beatWave = this.waveReached > this.previous.bestWave;
    const beatScore = this.xpTotal > this.previous.highScoreXp;

    if (!beatWave && !beatScore) {
      return;
    }

    const what = beatWave && beatScore ? 'WAVE AND SCORE' : beatWave ? 'FURTHEST WAVE' : 'HIGH SCORE';

    new Panel(this, width / 2, height / 2 - 20, 380, 36, BALANCE.palette.uiAccent);
    new Label(this, width / 2, height / 2 - 20, `NEW BEST — ${what}`, LabelVariant.HEADING)
      .setOrigin(0.5)
      .setVariantColor(BALANCE.palette.backdrop);
  }

  private showUpgrades(): void {
    const { width, height } = BALANCE.world;

    new Label(this, width / 2, height / 2 + 20, 'PICKED UP', LabelVariant.SMALL).setOrigin(0.5);

    const list = new UpgradeList(
      this,
      width / 2,
      height / 2 + 44,
      BALANCE.ui.upgradeList.capacity,
    );
    list.setOrigin(0.5);
    list.setFromIds(this.upgrades, getUpgradeData(this.registry));

    if (list.isEmpty) {
      new Label(
        this,
        width / 2,
        height / 2 + 44,
        this.victory ? 'nothing — cleared it bare-handed' : 'nothing — the run ended early',
        LabelVariant.SMALL,
      ).setOrigin(0.5);
    }
  }
}
