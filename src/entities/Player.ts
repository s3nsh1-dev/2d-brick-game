import * as Phaser from 'phaser';
import { Animator } from '../components/Animator';
import { Controls } from '../components/Controls';
import { Health } from '../components/Health';
import { Stats } from '../components/Stats';
import { Weapon } from '../components/Weapon';
import { BALANCE } from '../constants/balance';
import { StatId } from '../constants/stats';
import { Depth } from '../constants/depths';
import { PLAYER_ACTOR_ID } from '../constants/keys';
import { AnimState, frameTextureKey } from '../core/animKeys';
import { scratchA } from '../core/math';

// The player. Composes Health, Weapon and Controls; inherits only from Phaser's sprite.
//
// This is the one entity with an `update`. Enemies, projectiles and gems are driven by
// systems instead, which keeps them out of reach of Phaser's own `update` conventions.

export class Player extends Phaser.Physics.Arcade.Sprite {
  public readonly health = new Health(BALANCE.player.maxHp);
  public readonly weapon = new Weapon();
  /** Every upgradeable number. Systems read through this, never off `BALANCE` directly. */
  public readonly stats = new Stats();

  private readonly controls: Controls;
  private readonly animator: Animator;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, frameTextureKey(PLAYER_ACTOR_ID, AnimState.IDLE, 0));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.PLAYER);
    // The arena is exactly the world, so the engine's own bounds handling is the clamp.
    this.setCollideWorldBounds(true);

    this.controls = new Controls(scene);
    this.animator = new Animator(this, PLAYER_ACTOR_ID);
  }

  /** Called by GameScene with dt in seconds. Reads input and drives velocity. */
  public override update(dt: number): void {
    const speed = this.stats.get(StatId.MOVE_SPEED);
    const direction = this.controls.readDirection(scratchA);
    this.setVelocity(direction.x * speed, direction.y * speed);

    // Driven off the input rather than off the body's velocity: the two agree, and reading
    // the input avoids caring whether the physics step has run yet this frame.
    this.animator.play(
      direction.x === 0 && direction.y === 0 ? AnimState.IDLE : AnimState.WALK,
    );

    // The player owns the weapon, so it owns ticking the weapon's clock. CombatSystem
    // decides whether there is anything worth spending it on.
    this.weapon.update(dt);
  }

  /**
   * Applies damage and flinches. The animation lives here rather than in `VfxSystem`
   * because it is this entity's own state — deleting the presentation systems must leave
   * the game playable and unadorned, not leave entities unable to animate themselves.
   */
  public takeDamage(amount: number): void {
    this.health.damage(amount);
    this.animator.playOnce(AnimState.HIT);
  }

  /** Restores health. The cap is `Health`'s; overhealing is silently clamped, not banked. */
  public heal(amount: number): void {
    this.health.heal(amount);
  }

  public override destroy(fromScene?: boolean): void {
    this.controls.destroy();
    super.destroy(fromScene);
  }
}
