import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { StaticTextureKey } from '../constants/keys';
import type { EventBus, GameEvents } from '../core/EventBus';
import { ObjectPool } from '../core/ObjectPool';
import { FloatingText } from '../entities/FloatingText';
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

  /** Decomposed once: `Camera.flash` takes channels, and `balance.ts` stores a colour. */
  private readonly flashColor: Phaser.Types.Display.ColorObject;

  private readonly handleEnemyDamaged = (x: number, y: number, amount: number): void => {
    this.hitSpark.explode(BALANCE.vfx.hitSpark.count, x, y);
    this.showText(x, y, amount, BALANCE.vfx.floatingText.color);
  };

  private readonly handleEnemyDied = (x: number, y: number): void => {
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

    this.showText(x, y, amount, BALANCE.vfx.floatingText.playerDamageColor);
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

    this.bus.on('enemy:damaged', this.handleEnemyDamaged);
    this.bus.on('enemy:died', this.handleEnemyDied);
    this.bus.on('gem:collected', this.handleGemCollected);
    this.bus.on('player:damaged', this.handlePlayerDamaged);
  }

  public update(dt: number): void {
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
  }

  public destroy(): void {
    this.bus.off('enemy:damaged', this.handleEnemyDamaged);
    this.bus.off('enemy:died', this.handleEnemyDied);
    this.bus.off('gem:collected', this.handleGemCollected);
    this.bus.off('player:damaged', this.handlePlayerDamaged);

    this.texts.releaseAll();
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
