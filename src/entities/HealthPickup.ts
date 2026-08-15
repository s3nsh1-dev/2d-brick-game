import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { StaticTextureKey } from '../constants/keys';

// The health pickup. One per wave from `BALANCE.healthPickup.firstWave`, and it leaves if
// nobody comes for it.
//
// It blinks itself toward the end of its life for the same reason `Enemy` tints itself: that
// is this object's own state, not a service acting on it. Deleting `VfxSystem` must still
// leave a player able to see that the thing is about to go.
//
// Advanced by `tickLife` rather than by a tween or a TimerEvent, like everything else with a
// clock in this codebase — which is what keeps a paused run genuinely frozen.

export class HealthPickup extends Phaser.Physics.Arcade.Sprite {
  private lifeRemaining = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, StaticTextureKey.HEALTH_PICKUP);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.HEALTH_PICKUP);
    this.disableBody(true, true);
  }

  public get healAmount(): number {
    return BALANCE.healthPickup.healAmount;
  }

  public spawn(x: number, y: number): void {
    this.lifeRemaining = BALANCE.healthPickup.lifetimeSeconds;

    this.setAlpha(1);
    this.enableBody(true, x, y, true, true);
  }

  /** Returns true once it has expired and should be released. */
  public tickLife(dt: number): boolean {
    this.lifeRemaining -= dt;
    if (this.lifeRemaining <= 0) {
      return true;
    }

    const { blinkSeconds, blinkPerSecond } = BALANCE.healthPickup;
    if (this.lifeRemaining < blinkSeconds) {
      // A square wave rather than a fade: a pulse reads as urgency, where a smooth fade
      // reads as distance and would be mistaken for a depth effect.
      const phase = Math.floor(this.lifeRemaining * blinkPerSecond * 2) % 2;
      this.setAlpha(phase === 0 ? 1 : 0.25);
    }

    return false;
  }

  public despawn(): void {
    this.lifeRemaining = 0;

    // See Enemy.despawn: by the time a pool is released during scene teardown, Phaser has
    // already torn down the physics plugin and the body is gone.
    if (!this.body) {
      return;
    }

    this.disableBody(true, true);
  }
}
