import * as Phaser from 'phaser';
import { DataKey, SceneKey, TextureKey } from '../constants/keys';
import { readWaveDataFromCache } from '../data/schema';
// Imported for its URL rather than its contents so Vite serves and fingerprints the file,
// and Phaser's loader stays the single path by which game content enters the game.
import wavesUrl from '../data/waves.json?url';

// Loads and validates content, then bakes the Stage 1 art.
//
// Phaser 4 removed `Create.GenerateTexture` and `TextureManager.generate`, but
// `Graphics#generateTexture` survives, and a solid fill is exactly what it is good at.

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.PRELOAD);
  }

  public preload(): void {
    this.load.json(DataKey.WAVES, wavesUrl);
  }

  public create(): void {
    throw new Error('not implemented');
  }

  /** Bakes a solid square into a texture, so entities can be plain sprites. */
  private bakeSquareTexture(key: TextureKey, size: number, color: number): void {
    throw new Error('not implemented');
  }
}
