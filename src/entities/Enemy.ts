import * as Phaser from 'phaser';
import { Health } from '../components/Health';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import type { EnemyDefinition } from '../data/schema';

// Any enemy. Holds its own state and nothing else — it does not know where the player is or
// how to find them. CombatSystem steers it. That is what keeps entities free of global
// lookups, and it is why the swarmer and the brute are rows in `enemies.json` rather than
// subclasses: everything that differs between the types arrives through `spawn`.

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  public readonly health = new Health(BALANCE.enemy.baseHp);

  // Annotated, not inferred: `BALANCE` is `as const`, so the initialiser's type is the
  // literal 62 and an unannotated field would reject every other speed.
  private currentSpeed: number = BALANCE.enemy.baseSpeed;
  private contactCooldown = 0;

  /**
   * @param texture Any baked enemy texture. The pool builds every enemy before a wave has
   * asked for a type, and a sprite must have a real texture from the start or Phaser warns
   * and draws its missing-texture green. `spawn` overwrites it.
   */
  public constructor(scene: Phaser.Scene, texture: string) {
    super(scene, 0, 0, texture);

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

  /** `maxHp` and `speed` are already scaled; the definition supplies everything else. */
  public spawn(
    x: number,
    y: number,
    definition: EnemyDefinition,
    maxHp: number,
    speed: number,
  ): void {
    this.currentSpeed = speed;
    this.contactCooldown = 0;
    this.health.reset(maxHp);

    this.setTexture(definition.id);
    // `setTexture` resizes the sprite but not the physics body, so a pooled brute reused as
    // a swarmer would keep hitting at the brute's 30px reach.
    this.setBodySize(definition.size, definition.size);

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
