import * as Phaser from 'phaser';
import { SceneKey } from '../constants/keys';

// Stage 1 has nothing to load before the loading screen itself, so this scene only hands
// over to the preloader. It exists because that is where boot-time configuration goes the
// moment there is any.

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.BOOT);
  }

  public create(): void {
    this.scene.start(SceneKey.PRELOAD);
  }
}
