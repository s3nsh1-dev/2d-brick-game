import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';
import { EMPTY_SAVE, SaveStore, type SaveData, type StorageAdapter } from '../core/SaveStore';

export interface GameOverData {
  readonly waveReached: number;
  readonly xpTotal: number;
}

/**
 * The browser's storage, or nothing when it is unavailable.
 *
 * A browser with storage disabled throws on the property access itself, not on the first
 * call, which is why this is wrapped rather than passed straight through. `SaveStore` lives
 * in `core/` and may not name `window`; naming it here is the injection point.
 */
function browserStorage(): StorageAdapter | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

// End of run. Receives the run's own numbers through scene data rather than the bus, because
// by the time it exists the bus has been cleared and the run it is reporting on is gone.
//
// It is also where a run is folded into the permanent record. That belongs here rather than
// in GameScene because this is the moment the run is definitively over, and because a scene
// that is already displaying the result is the one place the totals are worth reading back.
//
// `Phaser.Scene` does not declare `init`, so typing the payload here needs no cast and no
// `override` — the engine calls whatever `init` it finds.

export class GameOverScene extends Phaser.Scene {
  private waveReached = 0;
  private xpTotal = 0;
  private records: SaveData = EMPTY_SAVE;

  private readonly restart = (): void => {
    this.scene.start(SceneKey.GAME);
  };

  public constructor() {
    super(SceneKey.GAME_OVER);
  }

  public init(data: GameOverData): void {
    this.waveReached = data.waveReached;
    this.xpTotal = data.xpTotal;

    // Recorded in `init` rather than `create` so the totals below are already up to date,
    // and so a run counts even if drawing this screen somehow fails.
    this.records = new SaveStore(browserStorage()).recordRun(data.waveReached, data.xpTotal);
  }

  public create(): void {
    const { width, height } = BALANCE.world;
    const { font } = BALANCE.ui;

    this.add
      .text(width / 2, height / 2 - 70, 'RUN OVER', {
        fontFamily: font.family,
        fontSize: font.titleSize,
        color: font.color,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(
        width / 2,
        height / 2 + 10,
        `reached wave ${String(this.waveReached)}  ·  ${String(this.xpTotal)} xp`,
        {
          fontFamily: font.family,
          fontSize: font.bodySize,
          color: font.color,
        },
      )
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(
        width / 2,
        height / 2 + 48,
        `best wave ${String(this.records.bestWave)}  ·  ` +
          `high score ${String(this.records.highScoreXp)} xp  ·  ` +
          `run ${String(this.records.totalRuns)}`,
        {
          fontFamily: font.family,
          fontSize: font.bodySize,
          color: font.dimColor,
        },
      )
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.add
      .text(width / 2, height / 2 + 96, 'press any key to run again', {
        fontFamily: font.family,
        fontSize: font.bodySize,
        color: font.dimColor,
      })
      .setOrigin(0.5)
      .setDepth(Depth.UI);

    this.input.keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, this.restart);
    this.input.once(Phaser.Input.Events.POINTER_DOWN, this.restart);
  }
}
