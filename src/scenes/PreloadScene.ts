import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { DataKey, PLAYER_ACTOR_ID, SceneKey, StaticTextureKey } from '../constants/keys';
import { ANIM_FRAME_COUNT, AnimState, animKey, frameTextureKey } from '../core/animKeys';
import {
  readEnemyDataFromCache,
  readUpgradeDataFromCache,
  readWaveDataFromCache,
} from '../data/schema';
// Imported for their URLs rather than their contents so Vite serves and fingerprints the
// files, and Phaser's loader stays the single path by which game content enters the game.
import enemiesUrl from '../data/enemies.json?url';
import upgradesUrl from '../data/upgrades.json?url';
import wavesUrl from '../data/waves.json?url';

// Loads and validates content, then bakes the art.
//
// Phaser 4 removed `Create.GenerateTexture` and `TextureManager.generate`, but
// `Graphics#generateTexture` survives, and a solid fill is exactly what it is good at.
//
// There is no atlas, deliberately. An atlas exists to stop batch breaks across many separate
// source images, and this project has no source images at all — every frame is baked here
// from a single Graphics object. An animation names the texture of each of its frames, so
// separately baked squares compose into one exactly as well as a packed strip would.

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super(SceneKey.PRELOAD);
  }

  public preload(): void {
    this.load.json(DataKey.WAVES, wavesUrl);
    this.load.json(DataKey.ENEMIES, enemiesUrl);
    this.load.json(DataKey.UPGRADES, upgradesUrl);
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
    this.registry.set(DataKey.UPGRADES, readUpgradeDataFromCache(this.cache));

    this.bakeSquare(StaticTextureKey.PROJECTILE, BALANCE.projectile.size, BALANCE.projectile.color);
    this.bakeSquare(StaticTextureKey.XP_GEM, BALANCE.gem.size, BALANCE.gem.color);
    // White, because every emitter tints it. Tinting a coloured texture multiplies, which
    // would make each effect a muddier version of whatever colour was baked in.
    this.bakeSquare(StaticTextureKey.SPARK, BALANCE.vfx.sparkSize, 0xffffff);

    this.bakeActor(PLAYER_ACTOR_ID, BALANCE.player.size, BALANCE.player.color);

    // One actor per enemy definition, keyed by the definition's id. This loop is the reason
    // a fourth enemy type needs no code: it bakes and animates whatever `enemies.json` lists.
    for (const enemy of enemies.enemies) {
      this.bakeActor(enemy.id, enemy.size, Phaser.Display.Color.HexStringToColor(enemy.color).color);
    }

    this.scene.start(SceneKey.MENU);
  }

  /**
   * Bakes every frame an actor needs and registers its animations.
   *
   * Each frame is baked on a canvas of the same size even when the shape drawn on it is
   * smaller, because an animation frame that changes the texture's dimensions also changes
   * the sprite's display size, and the walk bounce would read as the whole body pulsing.
   */
  private bakeActor(actorId: string, size: number, color: number): void {
    const { walkSquash, idleDim, hitWhiten, loopFrameRate, hitFrameRate } = BALANCE.anim;

    this.bakeSquare(frameTextureKey(actorId, AnimState.IDLE, 0), size, color);
    this.bakeSquare(frameTextureKey(actorId, AnimState.IDLE, 1), size, scale(color, idleDim));

    this.bakeSquare(frameTextureKey(actorId, AnimState.WALK, 0), size, color);
    // Squashed and sitting on the floor of its canvas, so the bounce reads as weight rather
    // than as the body shrinking toward its own middle.
    this.bakeStanding(
      frameTextureKey(actorId, AnimState.WALK, 1),
      size,
      Math.round(size * walkSquash),
      color,
    );

    this.bakeSquare(frameTextureKey(actorId, AnimState.HIT, 0), size, towardWhite(color, hitWhiten));

    this.createAnim(actorId, AnimState.IDLE, loopFrameRate, -1);
    this.createAnim(actorId, AnimState.WALK, loopFrameRate, -1);
    // Must not repeat: `Animator.playOnce` chains the standing loop back on, and a chained
    // animation only starts once the one before it completes. `repeat: -1` never does.
    this.createAnim(actorId, AnimState.HIT, hitFrameRate, 0);
  }

  private createAnim(actorId: string, state: AnimState, frameRate: number, repeat: number): void {
    const frames: Phaser.Types.Animations.AnimationFrame[] = [];
    for (let frame = 0; frame < ANIM_FRAME_COUNT[state]; frame += 1) {
      frames.push({ key: frameTextureKey(actorId, state, frame) });
    }

    this.anims.create({ key: animKey(actorId, state), frames, frameRate, repeat });
  }

  /** Bakes a solid square into a texture, so entities can be plain sprites. */
  private bakeSquare(key: string, size: number, color: number): void {
    this.bakeStanding(key, size, size, color);
  }

  /**
   * Bakes a `size`-wide shape of `shapeHeight` onto a `size`×`size` canvas, resting on its
   * bottom edge. Every frame of an actor is baked on the same canvas: a frame that changed
   * the texture's dimensions would change the sprite's display size with it.
   */
  private bakeStanding(key: string, size: number, shapeHeight: number, color: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, size - shapeHeight, size, shapeHeight);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}

// Colour arithmetic for the baked frames. Here rather than in `core/` because it produces
// art at boot and decides no game outcome, and here rather than in `constants/` because
// that folder forbids logic of any kind.

/** Multiplies each channel, for a frame that reads as the same colour lit less. */
function scale(color: number, factor: number): number {
  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
  return Phaser.Display.Color.GetColor(
    Math.round(r * factor),
    Math.round(g * factor),
    Math.round(b * factor),
  );
}

/** Mixes toward white, for the frame that reads as a flinch. */
function towardWhite(color: number, amount: number): number {
  const { r, g, b } = Phaser.Display.Color.IntegerToRGB(color);
  const mix = (channel: number): number => Math.round(channel + (255 - channel) * amount);
  return Phaser.Display.Color.GetColor(mix(r), mix(g), mix(b));
}
