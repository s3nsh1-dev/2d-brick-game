import { BALANCE } from '../constants/balance';
import type { EventBus, GameEvents } from '../core/EventBus';
import { distanceSquared, scratchA, setLength } from '../core/math';
import type { ObjectPool } from '../core/ObjectPool';
import type { Player } from '../entities/Player';
import type { XpGem } from '../entities/XpGem';
import type { System } from './System';

// Turns dead enemies into gems and gems into XP.
//
// It learns about deaths through the bus rather than from CombatSystem directly. That is a
// genuine cross-cutting edge — neither system owns the other — and it is what lets Stage 2
// add a second thing that drops on death without CombatSystem hearing about it.

export class PickupSystem implements System {
  private xpTotal = 0;

  private readonly handleEnemyDied = (x: number, y: number): void => {
    const gem = this.gems.acquire();
    if (gem === undefined) {
      return;
    }

    gem.spawn(x, y);
  };

  public constructor(
    private readonly player: Player,
    private readonly gems: ObjectPool<XpGem>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.bus.on('enemy:died', this.handleEnemyDied);
  }

  /**
   * No `dt`: gems are pulled by setting a velocity and letting the physics step integrate
   * it, so this system has nothing of its own to advance by time.
   */
  public update(_dt: number): void {
    const magnetRadiusSquared = BALANCE.gem.magnetRadius * BALANCE.gem.magnetRadius;

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

  /** Called by GameScene's player/gem overlap. */
  public onPlayerTouchedGem(gem: XpGem): void {
    if (!gem.active) {
      return;
    }

    this.xpTotal += gem.value;
    this.gems.release(gem);
    this.bus.emit('xp:changed', this.xpTotal);
  }

  public destroy(): void {
    this.bus.off('enemy:died', this.handleEnemyDied);
  }
}
