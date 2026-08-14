import * as Phaser from 'phaser';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { TextureKey } from '../constants/keys';

// A bullet. Carries no damage value of its own — Stage 1 has exactly one weapon, so
// CombatSystem reads the damage off that weapon at the moment of impact. Giving the
// projectile its own damage field would be building for a weapon roster that does not
// exist yet.

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  private lifetimeRemaining = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKey.PROJECTILE);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.PROJECTILE);
    this.disableBody(true, true);
  }

  /** `dirX`/`dirY` must already be normalised. */
  public fire(x: number, y: number, dirX: number, dirY: number): void {
    this.lifetimeRemaining = BALANCE.projectile.lifetimeSeconds;
    this.enableBody(true, x, y, true, true);
    this.setVelocity(dirX * BALANCE.projectile.speed, dirY * BALANCE.projectile.speed);
  }

  public despawn(): void {
    // See Enemy.despawn: the body is already gone by the time a pool is released during
    // scene teardown.
    if (!this.body) {
      return;
    }

    this.disableBody(true, true);
  }

  /** Returns true once the projectile has outlived its lifetime and should be released. */
  public tickLifetime(dt: number): boolean {
    this.lifetimeRemaining -= dt;
    return this.lifetimeRemaining <= 0;
  }
}
