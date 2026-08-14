import * as Phaser from 'phaser';
import { Health } from '../components/Health';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { TextureKey } from '../constants/keys';

// A grunt. Holds its own state and nothing else — it does not know where the player is or
// how to find them. CombatSystem steers it. That is what keeps entities free of global
// lookups and makes a second enemy type in Stage 2 a data change, not a rewrite.

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public readonly health = new Health(BALANCE.enemy.baseHp);

  // Annotated, not inferred: `BALANCE` is `as const`, so the initialiser's type is the
  // literal 62 and an unannotated field would reject every other speed.
  private currentSpeed: number = BALANCE.enemy.baseSpeed;
  private contactCooldown = 0;

  public constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKey.ENEMY);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.ENEMY);
    this.disableBody(true, true);
  }

  public get speed(): number {
    return this.currentSpeed;
  }

  /** True when enough time has passed since this grunt last hurt the player. */
  public get canDealContactDamage(): boolean {
    return this.contactCooldown <= 0;
  }

  public spawn(x: number, y: number, maxHp: number, speed: number): void {
    this.currentSpeed = speed;
    this.contactCooldown = 0;
    this.health.reset(maxHp);
    this.enableBody(true, x, y, true, true);
  }

  public despawn(): void {
    // Phaser shuts the Arcade Physics plugin down before this scene's SHUTDOWN handler
    // runs, so a pool released during teardown reaches sprites whose body is already gone
    // and `disableBody` would dereference it. The engine is destroying them anyway.
    if (!this.body) {
      return;
    }

    this.disableBody(true, true);
  }

  public tickContactCooldown(dt: number): void {
    if (this.contactCooldown > 0) {
      this.contactCooldown -= dt;
    }
  }

  /** Starts the contact cooldown. Called after the damage has been applied. */
  public consumeContactDamage(): void {
    this.contactCooldown = BALANCE.enemy.contactIntervalSeconds;
  }
}
