import type { EventBus, GameEvents } from '../core/EventBus';
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

  private readonly handleWaveStarted = (waveNumber: number): void => {
    this.currentWave = waveNumber;
  };

  private readonly handleXpChanged = (total: number): void => {
    this.currentXp = total;
  };

  public constructor(
    private readonly player: Player,
    private readonly enemies: ObjectPool<Enemy>,
    private readonly projectiles: ObjectPool<Projectile>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.bus.on('wave:started', this.handleWaveStarted);
    this.bus.on('xp:changed', this.handleXpChanged);
  }

  public update(dt: number): void {
    throw new Error('not implemented');
  }

  /** Called by GameScene's projectile/enemy overlap. */
  public onProjectileHitEnemy(projectile: Projectile, enemy: Enemy): void {
    throw new Error('not implemented');
  }

  /** Called by GameScene's player/enemy overlap, every frame the two are touching. */
  public onEnemyTouchedPlayer(enemy: Enemy): void {
    throw new Error('not implemented');
  }

  public destroy(): void {
    throw new Error('not implemented');
  }
}
