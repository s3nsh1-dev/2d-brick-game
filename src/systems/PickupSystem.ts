import type { EventBus, GameEvents } from '../core/EventBus';
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
    throw new Error('not implemented');
  };

  public constructor(
    private readonly player: Player,
    private readonly gems: ObjectPool<XpGem>,
    private readonly bus: EventBus<GameEvents>,
  ) {
    this.bus.on('enemy:died', this.handleEnemyDied);
  }

  public update(dt: number): void {
    throw new Error('not implemented');
  }

  /** Called by GameScene's player/gem overlap. */
  public onPlayerTouchedGem(gem: XpGem): void {
    throw new Error('not implemented');
  }

  public destroy(): void {
    throw new Error('not implemented');
  }
}
