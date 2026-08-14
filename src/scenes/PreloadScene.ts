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

    this.bakeArena();

    this.bakeSquare(StaticTextureKey.PROJECTILE, BALANCE.projectile.size, BALANCE.projectile.color);
    this.bakeSquare(StaticTextureKey.XP_GEM, BALANCE.gem.size, BALANCE.gem.color);
    // White, because every emitter tints it. Tinting a coloured texture multiplies, which
    // would make each effect a muddier version of whatever colour was baked in.
    this.bakeSquare(StaticTextureKey.SPARK, BALANCE.vfx.sparkSize, BALANCE.palette.spark);
    this.bakeRect(
      StaticTextureKey.SPAWN_MARKER,
      BALANCE.vfx.spawnMarker.width,
      BALANCE.vfx.spawnMarker.height,
      BALANCE.vfx.spawnMarker.color,
    );

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

  /**
   * Composites the whole arena into one texture: floor, grid, lit edge, wall and vignette.
   *
   * Drawn once here rather than per frame in a `Graphics` object. A Graphics rebuilds its
   * geometry every frame it is visible, and this one is ~30 lines plus eight gradient quads —
   * the sort of cost that is invisible at ten enemies and a measurable one at two hundred.
   *
   * It has to be a DynamicTexture rather than `generateTexture`: the latter renders through
   * the Canvas API, which silently drops `fillGradientStyle`, and the gradients are what the
   * edge glow and the vignette *are*.
   */
  private bakeArena(): void {
    // Annotated, not inferred. `BALANCE` is `as const`, so these are the literal types 1280
    // and 720, and a loop comparing a literal against a literal is a constant the linter is
    // right to reject. This is the same trap `docs/STATUS.md` records for class fields.
    const width: number = BALANCE.world.width;
    const height: number = BALANCE.world.height;
    const { palette, arena } = BALANCE;

    const texture = this.textures.addDynamicTexture(StaticTextureKey.ARENA, width, height);
    if (texture === null) {
      // Only possible if the key is already taken. Loud, because a silent failure here is a
      // black arena that looks like a rendering bug several files away.
      throw new Error(`Could not create the arena texture: '${StaticTextureKey.ARENA}' is taken.`);
    }

    const graphics = this.add.graphics();

    graphics.fillStyle(palette.arenaFloor, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.lineStyle(arena.gridLineWidth, palette.arenaGrid, arena.gridAlpha);
    for (let x = arena.gridCell; x < width; x += arena.gridCell) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = arena.gridCell; y < height; y += arena.gridCell) {
      graphics.lineBetween(0, y, width, y);
    }

    // Four bands fading inward from each side, in a colour darker than the floor. Where two
    // overlap they compound, which is why the corners end up darkest — that compounding is
    // what a vignette is, and it is the whole of the depth in this scene.
    const depth = arena.vignetteDepth;
    const vignetteAlpha = arena.vignetteAlpha;
    this.bakeInwardBand(graphics, palette.vignette, vignetteAlpha, 0, 0, width, depth, 'down');
    this.bakeInwardBand(graphics, palette.vignette, vignetteAlpha, 0, height - depth, width, depth, 'up');
    this.bakeInwardBand(graphics, palette.vignette, vignetteAlpha, 0, 0, depth, height, 'right');
    this.bakeInwardBand(graphics, palette.vignette, vignetteAlpha, width - depth, 0, depth, height, 'left');

    // The same trick in a lighter colour and a much shorter reach, drawn *after* the vignette
    // rather than before it. Underneath, the vignette simply cancelled it and the wall read
    // as a line drawn on a dark floor instead of as a lit surface.
    const glow = arena.edgeGlowWidth;
    this.bakeInwardBand(graphics, palette.arenaEdgeGlow, arena.edgeGlowAlpha, 0, 0, width, glow, 'down');
    this.bakeInwardBand(graphics, palette.arenaEdgeGlow, arena.edgeGlowAlpha, 0, height - glow, width, glow, 'up');
    this.bakeInwardBand(graphics, palette.arenaEdgeGlow, arena.edgeGlowAlpha, 0, 0, glow, height, 'right');
    this.bakeInwardBand(graphics, palette.arenaEdgeGlow, arena.edgeGlowAlpha, width - glow, 0, glow, height, 'left');

    // Last, so the wall sits on top of its own glow. Inset by half the stroke width because
    // a stroke straddles its path, and half of it would otherwise fall outside the texture.
    const half = arena.edgeWidth / 2;
    graphics.lineStyle(arena.edgeWidth, palette.arenaEdge, 1);
    graphics.strokeRect(half, half, width - arena.edgeWidth, height - arena.edgeWidth);

    texture.draw(graphics);
    texture.render();
    graphics.destroy();
  }

  /**
   * One rectangle whose alpha fades from `alpha` on the given edge to zero on the far side.
   *
   * `fillGradientStyle` takes four corner colours and four corner alphas; a directional fade
   * is the same colour at every corner with the alpha zeroed on two of them.
   */
  private bakeInwardBand(
    graphics: Phaser.GameObjects.Graphics,
    color: number,
    alpha: number,
    x: number,
    y: number,
    width: number,
    height: number,
    from: 'down' | 'up' | 'left' | 'right',
  ): void {
    const strong = alpha;
    const faint = 0;

    // Written out per direction rather than computed: four explicit cases are easier to read
    // and to correct by eye than the arithmetic that would produce them. The four alphas are
    // top-left, top-right, bottom-left, bottom-right.
    switch (from) {
      case 'down':
        graphics.fillGradientStyle(color, color, color, color, strong, strong, faint, faint);
        break;
      case 'up':
        graphics.fillGradientStyle(color, color, color, color, faint, faint, strong, strong);
        break;
      case 'right':
        graphics.fillGradientStyle(color, color, color, color, strong, faint, strong, faint);
        break;
      default:
        graphics.fillGradientStyle(color, color, color, color, faint, strong, faint, strong);
        break;
    }

    graphics.fillRect(x, y, width, height);
  }

  /** Bakes a solid square into a texture, so entities can be plain sprites. */
  private bakeSquare(key: string, size: number, color: number): void {
    this.bakeStanding(key, size, size, color);
  }

  /** Bakes a solid rectangle. Squares go through `bakeSquare`; this is for the odd bar. */
  private bakeRect(key: string, width: number, height: number, color: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
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
