import { BALANCE } from '../constants/balance';
import { StatId } from '../constants/stats';
import type { EventBus, GameEvents } from '../core/EventBus';
import { nearest, scratchA, setLength } from '../core/math';
import type { ObjectPool } from '../core/ObjectPool';
import type { Enemy } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import type { Projectile } from '../entities/Projectile';
import type { System } from './System';

// The whole fight loop: enemies pursuing, the weapon acquiring and firing, projectiles
// ageing out, and damage resolving in both directions.
//
// Enemy pursuit lives here rather than in a MovementSystem because Stage 1 defines exactly
// three systems. Grouping it with damage is the least arbitrary of the available homes —
// everything in this file is about the exchange between the player and the enemies.
//
// The two `on*` methods are called straight from GameScene's collider callbacks rather than
// through the bus. A bus event per bullet impact would allocate an argument array in the
// hottest path in the game, and the scene already owns this system, so the call is a parent
// reaching into its child rather than the cross-cutting traffic invariant 3 is about.

export class CombatSystem implements System {
  private currentWave = 1;
  private currentXp = 0;
  private runEnded = false;
  private hitStopRemaining = 0;

  /**
   * Set when the wave timeline is exhausted. The run is not over yet — the last enemies are
   * still on the board, and killing them is the win.
   */
  private awaitingClear = false;

  private readonly handleWaveStarted = (waveNumber: number): void => {
    this.currentWave = waveNumber;
  };

  private readonly handleXpChanged = (total: number): void => {
    this.currentXp = total;
  };

  private readonly handleWavesCleared = (): void => {
    this.awaitingClear = true;
  };

  public constructor(
    private readonly player: Player,
    private readonly enemies: ObjectPool<Enemy>,
    private readonly projectiles: ObjectPool<Projectile>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.bus.on('wave:started', this.handleWaveStarted);
    this.bus.on('xp:changed', this.handleXpChanged);
    this.bus.on('waves:cleared', this.handleWavesCleared);
  }

  public update(dt: number): void {
    if (this.runEnded) {
      return;
    }

    this.steerEnemies(dt);
    this.fire();
    this.ageProjectiles(dt);

    // Checked after the fight resolves, so a frame that kills the last enemy wins on that
    // same frame rather than on the next one.
    if (this.awaitingClear && this.enemies.activeCount === 0) {
      this.runEnded = true;
      this.bus.emit('run:ended', this.currentWave, this.currentXp, true);
    }
  }

  /** Called by GameScene's projectile/enemy overlap. */
  public onProjectileHitEnemy(projectile: Projectile, enemy: Enemy): void {
    // Both guards matter: one physics step can report several pairs involving a sprite that
    // an earlier pair already released back to its pool.
    if (this.runEnded || !projectile.active || !enemy.active) {
      return;
    }

    this.projectiles.release(projectile);

    const damage = this.player.stats.get(StatId.WEAPON_DAMAGE);
    enemy.takeDamage(damage);
    this.bus.emit('enemy:damaged', enemy.x, enemy.y, damage);

    if (!enemy.health.isDead) {
      // Away from the player, because that is where the shot came from. Read off positions
      // rather than the projectile's velocity: it has already gone back to its pool.
      const direction = setLength(scratchA, enemy.x - this.player.x, enemy.y - this.player.y, 1);
      enemy.applyKnockback(direction.x, direction.y);
      return;
    }

    // Coalesced with `max`, not summed: forty enemies dying in one frame is one freeze.
    this.hitStopRemaining = Math.max(this.hitStopRemaining, BALANCE.combat.hitStopSeconds);

    const deathX = enemy.x;
    const deathY = enemy.y;
    this.enemies.release(enemy);
    this.bus.emit('enemy:died', deathX, deathY);
  }

  /** Called by GameScene's player/enemy overlap, every frame the two are touching. */
  public onEnemyTouchedPlayer(enemy: Enemy): void {
    if (this.runEnded || !enemy.active || !enemy.canDealContactDamage) {
      return;
    }

    enemy.consumeContactDamage();

    const health = this.player.health;
    this.player.takeDamage(BALANCE.enemy.contactDamage);
    this.bus.emit('player:health-changed', health.current, health.max);
    this.bus.emit(
      'player:damaged',
      this.player.x,
      this.player.y,
      BALANCE.enemy.contactDamage,
    );

    if (health.isDead) {
      this.runEnded = true;
      this.bus.emit('run:ended', this.currentWave, this.currentXp, false);
    }
  }

  public destroy(): void {
    this.bus.off('wave:started', this.handleWaveStarted);
    this.bus.off('xp:changed', this.handleXpChanged);
    this.bus.off('waves:cleared', this.handleWavesCleared);
  }

  /**
   * Spends this frame's share of any hit-stop, and reports whether the world is still
   * frozen. `GameScene` asks once per frame and skips the simulation while it is true.
   *
   * The clock lives here because the death that started it does. It is deliberately not a
   * `System.update` step: by the time the systems run, the scene has already had to decide
   * whether this frame happens at all.
   */
  public tickHitStop(dt: number): boolean {
    if (this.hitStopRemaining <= 0) {
      return false;
    }

    this.hitStopRemaining -= dt;
    return true;
  }

  private steerEnemies(dt: number): void {
    for (const enemy of this.enemies.active) {
      enemy.tickContactCooldown(dt);
      enemy.tickKnockback(dt);

      // Its velocity is the knockback until that expires. Steering it now would cancel the
      // hit on the same frame it landed.
      if (enemy.isKnockedBack) {
        continue;
      }

      const direction = setLength(
        scratchA,
        this.player.x - enemy.x,
        this.player.y - enemy.y,
        enemy.speed,
      );
      enemy.setVelocity(direction.x, direction.y);
    }
  }

  private fire(): void {
    const weapon = this.player.weapon;
    if (!weapon.isReady) {
      return;
    }

    const stats = this.player.stats;
    const target = nearest(
      this.player.x,
      this.player.y,
      this.enemies.active,
      stats.get(StatId.WEAPON_RANGE),
    );
    if (target === undefined) {
      return;
    }

    const projectile = this.projectiles.acquire();
    if (projectile === undefined) {
      return;
    }

    // Readiness was checked above, so this always succeeds; calling it is what spends the
    // cooldown. Spending it only once a projectile is in hand keeps an exhausted pool from
    // silently eating shots.
    weapon.tryFire(stats.get(StatId.WEAPON_COOLDOWN));

    const direction = setLength(scratchA, target.x - this.player.x, target.y - this.player.y, 1);
    projectile.fire(this.player.x, this.player.y, direction.x, direction.y);
    this.bus.emit('weapon:fired', this.player.x, this.player.y);
  }

  private ageProjectiles(dt: number): void {
    const projectiles = this.projectiles.active;

    // Backwards, because `release` swap-removes from this same array.
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      if (projectile === undefined) {
        continue;
      }

      if (projectile.tickLifetime(dt)) {
        this.projectiles.release(projectile);
      }
    }
  }
}
