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

  private currentSpeed = BALANCE.enemy.baseSpeed;
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
    throw new Error('not implemented');
  }

  public spawn(x: number, y: number, maxHp: number, speed: number): void {
    throw new Error('not implemented');
  }

  public despawn(): void {
    throw new Error('not implemented');
  }

  public tickContactCooldown(dt: number): void {
    throw new Error('not implemented');
  }

  /** Starts the contact cooldown. Called after the damage has been applied. */
  public consumeContactDamage(): void {
    throw new Error('not implemented');
  }
}
