import * as Phaser from 'phaser';
import { Animator } from '../components/Animator';
import { Health } from '../components/Health';
import { BALANCE } from '../constants/balance';
import { Depth } from '../constants/depths';
import { AnimState, frameTextureKey, paletteActorId } from '../core/animKeys';
import { damageTint } from '../core/color';
import { settings } from '../platform/settings';
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
  private knockbackRemaining = 0;

  private readonly animator: Animator;

  /**
   * @param actorId Any baked enemy actor id. The pool builds every enemy before a wave has
   * asked for a type, and a sprite must have a real texture from the start or Phaser warns
   * and draws its missing-texture green. `spawn` retargets it.
   */
  public constructor(scene: Phaser.Scene, actorId: string) {
    super(scene, 0, 0, frameTextureKey(actorId, AnimState.IDLE, 0));

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(Depth.ENEMY);
    this.animator = new Animator(this, actorId);
    this.disableBody(true, true);
  }

  public get speed(): number {
    return this.currentSpeed;
  }

  /** True when enough time has passed since this enemy last hurt the player. */
  public get canDealContactDamage(): boolean {
    return this.contactCooldown <= 0;
  }

  /** While true its velocity is the knockback, and pursuit must not overwrite it. */
  public get isKnockedBack(): boolean {
    return this.knockbackRemaining > 0;
  }

  /**
   * How hurt this enemy looks. Recomputed on damage, not per frame.
   *
   * Presentation living on the entity, for the same reason the hit frame does: it is this
   * enemy's own state, not a service acting on it. Deleting `VfxSystem` must leave the game
   * unadorned but still able to show that a brute has taken twenty hits — which, at 6× HP,
   * is the difference between a readable board and two hundred identical squares.
   */
  private applyDamageTint(): void {
    const ratio = this.health.max <= 0 ? 0 : this.health.current / this.health.max;
    this.setTint(damageTint(ratio, BALANCE.vfx.enemyDamageTintFloor));
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
    this.knockbackRemaining = 0;
    this.health.reset(maxHp);

    // A pooled enemy carries the last one's tint, so a fresh brute would otherwise spawn
    // looking half dead. Cleared before the body is enabled, not after.
    this.clearTint();

    // A pooled enemy is reused across types, and the frames a brute plays are not the
    // frames a swarmer plays. The palette chooses between two sets baked at boot, so an
    // enemy already walking keeps the colours it entered with — the swap lands on the next
    // one to spawn rather than repainting the board mid-wave.
    this.animator.retarget(paletteActorId(definition.id, settings.get().colourblind));
    // `setBodySize`, because the animation sets the texture but never the physics body, and
    // a pooled brute reused as a swarmer would keep hitting at the brute's 30px reach.
    this.setBodySize(definition.size, definition.size);

    this.enableBody(true, x, y, true, true);

    // Enemies are steered every frame for their whole life, so walking is their resting
    // state; `idle` is baked for every actor but only the player ever stands still.
    this.animator.play(AnimState.WALK);
  }

  /** Applies damage and flinches. See `Player.takeDamage` for why the animation is here. */
  public takeDamage(amount: number): void {
    this.health.damage(amount);
    this.animator.playOnce(AnimState.HIT);
    this.applyDamageTint();
  }

  public despawn(): void {
    this.animator.reset();

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

  public tickKnockback(dt: number): void {
    if (this.knockbackRemaining > 0) {
      this.knockbackRemaining -= dt;
    }
  }

  /**
   * Throws this enemy along an already-normalised direction and suspends its pursuit for
   * the knockback's duration. Re-applying while airborne restarts the clock rather than
   * adding to it, so a stream of hits holds an enemy off instead of launching it.
   *
   * @param dirX Normalised. CombatSystem decides the direction; the speed is balance.
   */
  public applyKnockback(dirX: number, dirY: number): void {
    this.knockbackRemaining = BALANCE.combat.knockback.durationSeconds;
    this.setVelocity(dirX * BALANCE.combat.knockback.speed, dirY * BALANCE.combat.knockback.speed);
  }

  /** Starts the contact cooldown. Called after the damage has been applied. */
  public consumeContactDamage(): void {
    this.contactCooldown = BALANCE.enemy.contactIntervalSeconds;
  }
}
