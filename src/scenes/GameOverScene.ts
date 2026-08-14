import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { SceneKey } from '../constants/keys';

export interface GameOverData {
  readonly waveReached: number;
  readonly xpTotal: number;
}

// End of run. Receives its numbers through scene data rather than the bus, because by the
// time it exists the bus has been cleared and the run it is reporting on is gone.
//
// `Phaser.Scene` does not declare `init`, so typing the payload here needs no cast and no
// `override` — the engine calls whatever `init` it finds.

export class GameOverScene extends Phaser.Scene {
  private waveReached = 0;
  private xpTotal = 0;

  private readonly restart = (): void => {
    this.scene.start(SceneKey.GAME);
  };

  public constructor() {
    super(SceneKey.GAME_OVER);
  }

  public init(data: GameOverData): void {
    this.waveReached = data.waveReached;
    this.xpTotal = data.xpTotal;
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
      .text(width / 2, height / 2 + 60, 'press any key to run again', {
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
