import * as Phaser from 'phaser';
import { SceneKey } from '../constants/keys';
import { loadSettings } from '../platform/settings';

// Boot-time configuration. Stage 1 described this scene as "the seam where boot-time
// configuration will go the moment there is any"; Stage 3 gave it something to do.
//
// The settings have to be read here rather than in `PreloadScene`, because the preloader
// bakes the art and the colourblind option decides which colours it bakes.

export class BootScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.BOOT);
  }

  public create(): void {
    loadSettings();
    this.scene.start(SceneKey.PRELOAD);
  }
}
