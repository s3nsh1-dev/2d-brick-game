import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { StaticTextureKey } from '../constants/keys';
import { toCssColor } from '../core/color';
import type { EventBus, GameEvents } from '../core/EventBus';
import { clamp } from '../core/math';
import { ObjectPool } from '../core/ObjectPool';
import { FloatingText } from '../entities/FloatingText';
import { SpawnMarker } from '../entities/SpawnMarker';
import type { System } from './System';

// Every particle, camera effect and damage number in the game. Subscribes to the bus and
// never calls into gameplay — deleting this file leaves a fully playable, unadorned game
// (invariant 11), with identical timing, because nothing here moves a body or spends time.
//
// Invariant 12: the three emitters and the whole floating-text pool are built here, once, in
// the constructor. A hit re-triggers an existing emitter at a position; it never creates one.
//
// The randomness in the emitter configs — spark angles, speeds — is exempt from the Stage 3
// seeding pass on purpose. It decides no gameplay outcome, and routing it through a seeded
// generator would buy determinism nobody can observe.

export class VfxSystem implements System {
  private readonly hitSpark: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly deathBurst: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly pickupSparkle: Phaser.GameObjects.Particles.ParticleEmitter;

  private readonly texts: ObjectPool<FloatingText>;
  private readonly markers: ObjectPool<SpawnMarker>;

  /** Decomposed once: `Camera.flash` takes channels, and `balance.ts` stores a colour. */
  private readonly flashColor: Phaser.Types.Display.ColorObject;

  /**
   * The palette's damage colours as CSS, converted once.
   *
   * Phaser's text style wants a string and the palette stores an integer. Converting per hit
   * would allocate a string on every impact, which at two hundred enemies is exactly the
   * kind of per-frame garbage invariant 6 exists to keep out.
   */
  private readonly enemyDamageCss = toCssColor(BALANCE.vfx.floatingText.color);
  private readonly playerDamageCss = toCssColor(BALANCE.vfx.floatingText.playerDamageColor);

  /**
   * What this frame has already drawn. Reset at the top of `update`.
   *
   * The window is one frame rather than one second because that is where the problem is: a
   * wave 8 frame can contain forty deaths, and the next frame usually contains none. A
   * per-second budget would smear the cap across the quiet frames and still let the loud
   * one through.
   */
  private burstsThisFrame = 0;
  private sparksThisFrame = 0;
  private textsThisFrame = 0;

  private readonly handleEnemyDamaged = (x: number, y: number, amount: number): void => {
    if (this.sparksThisFrame < BALANCE.vfx.budget.sparksPerFrame) {
      this.sparksThisFrame += 1;
      this.hitSpark.explode(BALANCE.vfx.hitSpark.count, x, y);
    }

    if (this.textsThisFrame < BALANCE.vfx.budget.textsPerFrame) {
      this.textsThisFrame += 1;
      this.showText(x, y, amount, this.enemyDamageCss);
    }
  };

  /**
   * Marks the wall an enemy is about to cross.
   *
   * The spawn position is on the ring *outside* the arena, so exactly one of its coordinates
   * is out of bounds; clamping both gives the point on the wall the enemy will walk through,
   * and which coordinate moved says whether the bar lies flat or stands on end.
   */
  private readonly handleEnemySpawned = (x: number, y: number): void => {
    const marker = this.markers.acquire();
    if (marker === undefined) {
      return;
    }

    const { width, height } = BALANCE.world;
    const { inset } = BALANCE.vfx.spawnMarker;
    const vertical = x < 0 || x > width;

    marker.show(
      clamp(x, inset, width - inset),
      clamp(y, inset, height - inset),
      vertical,
    );
  };

  private readonly handleEnemyDied = (x: number, y: number): void => {
    if (this.burstsThisFrame >= BALANCE.vfx.budget.burstsPerFrame) {
      return;
    }

    this.burstsThisFrame += 1;
    this.deathBurst.explode(BALANCE.vfx.deathBurst.count, x, y);
  };

  private readonly handleGemCollected = (x: number, y: number): void => {
    this.pickupSparkle.explode(BALANCE.vfx.pickupSparkle.count, x, y);
  };

  private readonly handlePlayerDamaged = (x: number, y: number, amount: number): void => {
    const { shake, flash } = BALANCE.vfx;
    const camera = this.scene.cameras.main;

    camera.shake(shake.durationMs, shake.intensity);
    camera.flash(flash.durationMs, this.flashColor.r, this.flashColor.g, this.flashColor.b);

    // Exempt from the per-frame text budget. It is bounded by the per-enemy contact interval
    // rather than by how many enemies are on screen, and it is the one number a player must
    // never miss because a crowd was being noisy in the same frame.
    this.showText(x, y, amount, this.playerDamageCss);
  };

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.hitSpark = this.createEmitter(BALANCE.vfx.hitSpark);
    this.deathBurst = this.createEmitter(BALANCE.vfx.deathBurst);
    this.pickupSparkle = this.createEmitter(BALANCE.vfx.pickupSparkle);

    this.flashColor = Phaser.Display.Color.IntegerToRGB(BALANCE.vfx.flash.color);

    this.texts = new ObjectPool<FloatingText>(
      BALANCE.vfx.floatingText.poolSize,
      () => new FloatingText(this.scene),
      (text) => {
        text.despawn();
      },
    );

    this.markers = new ObjectPool<SpawnMarker>(
      BALANCE.vfx.spawnMarker.poolSize,
      () => new SpawnMarker(this.scene),
      (marker) => {
        marker.despawn();
      },
    );

    this.bus.on('enemy:spawned', this.handleEnemySpawned);
    this.bus.on('enemy:damaged', this.handleEnemyDamaged);
    this.bus.on('enemy:died', this.handleEnemyDied);
    this.bus.on('gem:collected', this.handleGemCollected);
    this.bus.on('player:damaged', this.handlePlayerDamaged);
  }

  public update(dt: number): void {
    // Reset here rather than at the end of the frame: Phaser steps the physics world after
    // `GameScene.update` returns, so every collision — and therefore every effect event —
    // lands between one call to this method and the next.
    this.burstsThisFrame = 0;
    this.sparksThisFrame = 0;
    this.textsThisFrame = 0;

    const texts = this.texts.active;

    // Backwards, because `release` swap-removes from this same array.
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      const text = texts[i];
      if (text === undefined) {
        continue;
      }

      if (text.tickLife(dt)) {
        this.texts.release(text);
      }
    }

    const markers = this.markers.active;
    for (let i = markers.length - 1; i >= 0; i -= 1) {
      const marker = markers[i];
      if (marker === undefined) {
        continue;
      }

      if (marker.tickLife(dt)) {
        this.markers.release(marker);
      }
    }
  }

  public destroy(): void {
    this.bus.off('enemy:spawned', this.handleEnemySpawned);
    this.bus.off('enemy:damaged', this.handleEnemyDamaged);
    this.bus.off('enemy:died', this.handleEnemyDied);
    this.bus.off('gem:collected', this.handleGemCollected);
    this.bus.off('player:damaged', this.handlePlayerDamaged);

    this.texts.releaseAll();
    this.markers.releaseAll();
  }

  /**
   * One emitter per effect, in explode mode so it emits only when told to.
   *
   * `frequency: -1` is what stops it flowing on its own; `emitting: false` alone would still
   * leave a flow emitter that any later `start()` would run continuously.
   */
  private createEmitter(spec: {
    readonly speedMin: number;
    readonly speedMax: number;
    readonly lifespanMs: number;
    readonly scaleStart: number;
    readonly scaleEnd: number;
    readonly color: number;
  }): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, StaticTextureKey.SPARK, {
      speed: { min: spec.speedMin, max: spec.speedMax },
      lifespan: spec.lifespanMs,
      scale: { start: spec.scaleStart, end: spec.scaleEnd },
      alpha: { start: 1, end: 0 },
      tint: spec.color,
      frequency: -1,
      emitting: false,
    });

    emitter.setDepth(Depth.PARTICLE);
    return emitter;
  }

  /** A damage number, rounded because a player reading "7.4000001" is a bug report. */
  private showText(x: number, y: number, amount: number, color: string): void {
    const text = this.texts.acquire();
    if (text === undefined) {
      return;
    }

    text.show(x, y, String(Math.round(amount)), color);
  }
}
