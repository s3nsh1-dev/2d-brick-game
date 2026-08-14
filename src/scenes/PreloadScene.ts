import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
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
    // `.parse`, not `.safeParse`: bad content must take the boot sequence down here, in
    // front of the developer, rather than surface as an empty wave several minutes in.
    this.registry.set(DataKey.WAVES, readWaveDataFromCache(this.cache));

    this.bakeSquareTexture(TextureKey.PLAYER, BALANCE.player.size, BALANCE.player.color);
    this.bakeSquareTexture(TextureKey.ENEMY, BALANCE.enemy.size, BALANCE.enemy.color);
    this.bakeSquareTexture(
      TextureKey.PROJECTILE,
      BALANCE.projectile.size,
      BALANCE.projectile.color,
    );
    this.bakeSquareTexture(TextureKey.XP_GEM, BALANCE.gem.size, BALANCE.gem.color);

    this.scene.start(SceneKey.MENU);
  }

  /** Bakes a solid square into a texture, so entities can be plain sprites. */
  private bakeSquareTexture(key: TextureKey, size: number, color: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
