import { BALANCE } from '../constants/balance';
import { StatId } from '../constants/stats';
import type { EventBus, GameEvents } from '../core/EventBus';
import { distanceSquared, scratchA, setLength } from '../core/math';
import type { ObjectPool } from '../core/ObjectPool';
import type { HealthPickup } from '../entities/HealthPickup';
import type { Player } from '../entities/Player';
import type { XpGem } from '../entities/XpGem';
import type { System } from './System';

// Turns dead enemies into gems, gems into XP, and — from `healthPickup.firstWave` — one
// wave into one chance to get some health back.
//
// It learns about deaths and waves through the bus rather than from the systems that own
// them. Those are genuine cross-cutting edges: no system here owns another.
//
// It emits `player:health-changed` itself rather than asking `CombatSystem` to. The event
// states a fact about the player, not a fact about combat, and two emitters of one fact is a
// far smaller thing than a direct reference between two systems that do not own each other.

export class PickupSystem implements System {
  private xpTotal = 0;

  /** Counts down to this wave's pickup. Negative means the wave has had its one. */
  private healthSpawnCountdown = -1;

  private readonly handleEnemyDied = (x: number, y: number): void => {
    const gem = this.gems.acquire();
    if (gem === undefined) {
      return;
    }

    gem.spawn(x, y);
  };

  private readonly handleWaveStarted = (waveNumber: number): void => {
    this.healthSpawnCountdown =
      waveNumber >= BALANCE.healthPickup.firstWave
        ? BALANCE.healthPickup.spawnDelaySeconds
        : -1;
  };

  public constructor(
    private readonly player: Player,
    private readonly gems: ObjectPool<XpGem>,
    private readonly health: ObjectPool<HealthPickup>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.bus.on('enemy:died', this.handleEnemyDied);
    this.bus.on('wave:started', this.handleWaveStarted);
  }

  public update(dt: number): void {
    this.pullGems();
    this.tickHealthPickups(dt);
  }

  /** Called by GameScene's player/gem overlap. */
  public onPlayerTouchedGem(gem: XpGem): void {
    if (!gem.active) {
      return;
    }

    const { x, y } = gem;

    this.xpTotal += gem.value;
    this.gems.release(gem);
    this.bus.emit('xp:changed', this.xpTotal);
    this.bus.emit('gem:collected', x, y);
  }

  /** Called by GameScene's player/health-pickup overlap. */
  public onPlayerTouchedHealth(pickup: HealthPickup): void {
    if (!pickup.active) {
      return;
    }

    const { x, y } = pickup;

    this.player.heal(pickup.healAmount);
    this.health.release(pickup);

    const health = this.player.health;
    this.bus.emit('player:health-changed', health.current, health.max);
    this.bus.emit('pickup:health', x, y);
  }

  public destroy(): void {
    this.bus.off('enemy:died', this.handleEnemyDied);
    this.bus.off('wave:started', this.handleWaveStarted);
    this.healthSpawnCountdown = -1;
  }

  /**
   * No `dt`: gems are pulled by setting a velocity and letting the physics step integrate it,
   * so there is nothing of the gems' own to advance by time.
   */
  private pullGems(): void {
    // Read every frame rather than cached: it is upgradeable, and invariant 14 makes the
    // value a computation whose cached copy goes stale the moment a level-up lands.
    const magnetRadius = this.player.stats.get(StatId.MAGNET_RADIUS);
    const magnetRadiusSquared = magnetRadius * magnetRadius;

    for (const gem of this.gems.active) {
      const distance = distanceSquared(this.player.x, this.player.y, gem.x, gem.y);
      if (distance > magnetRadiusSquared) {
        gem.setVelocity(0, 0);
        continue;
      }

      const direction = setLength(
        scratchA,
        this.player.x - gem.x,
        this.player.y - gem.y,
        BALANCE.gem.magnetSpeed,
      );
      gem.setVelocity(direction.x, direction.y);
    }
  }

  /** Ages the pickups on the floor, and drops this wave's one when its delay runs out. */
  private tickHealthPickups(dt: number): void {
    if (this.healthSpawnCountdown > 0) {
      this.healthSpawnCountdown -= dt;
      if (this.healthSpawnCountdown <= 0) {
        this.spawnHealthPickup();
      }
    }

    const active = this.health.active;

    // Backwards, because `release` swap-removes from this same array.
    for (let i = active.length - 1; i >= 0; i -= 1) {
      const pickup = active[i];
      if (pickup === undefined) {
        continue;
      }

      if (pickup.tickLife(dt)) {
        this.health.release(pickup);
      }
    }
  }

  /**
   * Places it somewhere inside the arena that is not on top of the player.
   *
   * Rejection sampling with a hard cap rather than a loop that must succeed: the arena is
   * far larger than the exclusion circle, so the first draw almost always lands, and a
   * bounded number of tries cannot hang a frame however the numbers are later tuned.
   */
  private spawnHealthPickup(): void {
    const pickup = this.health.acquire();
    if (pickup === undefined) {
      return;
    }

    const { edgeMargin, minPlayerDistance } = BALANCE.healthPickup;
    const spanX = BALANCE.world.width - edgeMargin * 2;
    const spanY = BALANCE.world.height - edgeMargin * 2;
    const minimumSquared = minPlayerDistance * minPlayerDistance;

    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
      x = edgeMargin + Math.random() * spanX;
      y = edgeMargin + Math.random() * spanY;

      if (distanceSquared(this.player.x, this.player.y, x, y) >= minimumSquared) {
        break;
      }
    }

    pickup.spawn(x, y);
  }
}

/**
 * How many placements to try before accepting the last one.
 *
 * Not in `balance.ts`: it tunes nothing about how the game plays, it only bounds a loop. The
 * eighth draw landing near the player is a cosmetic near-miss, not a balance decision.
 */
const SPAWN_ATTEMPTS = 8;
