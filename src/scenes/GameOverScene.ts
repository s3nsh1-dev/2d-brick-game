import * as Phaser from 'phaser';
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

  public constructor() {
    super(SceneKey.GAME_OVER);
  }

  public init(data: GameOverData): void {
    this.waveReached = data.waveReached;
    this.xpTotal = data.xpTotal;
  }

  public create(): void {
    throw new Error('not implemented');
  }
}
