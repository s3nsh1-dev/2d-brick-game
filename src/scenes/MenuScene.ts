import * as Phaser from 'phaser';
import { SceneKey } from '../constants/keys';

// Title card. Any key or click starts a run.

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.MENU);
  }

  public create(): void {
    throw new Error('not implemented');
  }
}
