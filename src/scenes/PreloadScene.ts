import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { DataKey, SceneKey, TextureKey } from '../constants/keys';
import { readEnemyDataFromCache, readWaveDataFromCache } from '../data/schema';
// Imported for their URLs rather than their contents so Vite serves and fingerprints the
// files, and Phaser's loader stays the single path by which game content enters the game.
import enemiesUrl from '../data/enemies.json?url';
import wavesUrl from '../data/waves.json?url';

// Loads and validates content, then bakes the art.
//
// Phaser 4 removed `Create.GenerateTexture` and `TextureManager.generate`, but
// `Graphics#generateTexture` survives, and a solid fill is exactly what it is good at.

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.PRELOAD);
  }

  public preload(): void {
    this.load.json(DataKey.WAVES, wavesUrl);
    this.load.json(DataKey.ENEMIES, enemiesUrl);
  }

  public create(): void {
    // `.parse`, not `.safeParse`: bad content must take the boot sequence down here, in
    // front of the developer, rather than surface as an empty wave several minutes in.
    //
    // Enemies first, and not only for tidiness: the wave schema's enemy id is a union over
    // the ids this file defines, so it cannot be built until they are known.
    const enemies = readEnemyDataFromCache(this.cache);
    this.registry.set(DataKey.ENEMIES, enemies);
    this.registry.set(DataKey.WAVES, readWaveDataFromCache(this.cache, enemies));

    this.bakeSquareTexture(TextureKey.PLAYER, BALANCE.player.size, BALANCE.player.color);
    this.bakeSquareTexture(
      TextureKey.PROJECTILE,
      BALANCE.projectile.size,
      BALANCE.projectile.color,
    );
    this.bakeSquareTexture(TextureKey.XP_GEM, BALANCE.gem.size, BALANCE.gem.color);

    // One texture per enemy definition, keyed by the definition's id. This loop is the
    // reason a fourth enemy type needs no code: it bakes whatever `enemies.json` lists.
    for (const enemy of enemies.enemies) {
      this.bakeSquareTexture(
        enemy.id,
        enemy.size,
        Phaser.Display.Color.HexStringToColor(enemy.color).color,
      );
    }

    this.scene.start(SceneKey.MENU);
  }

  /** Bakes a solid square into a texture, so entities can be plain sprites. */
  private bakeSquareTexture(key: string, size: number, color: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, size, size);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
