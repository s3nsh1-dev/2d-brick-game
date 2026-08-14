import { BALANCE } from '../constants/balance';
import { StatId } from '../constants/stats';
import { type Modifier, StatBlock } from '../core/StatBlock';

// Every upgradeable number the player has, one `StatBlock` each.
//
// The bases come from `balance.ts`, so an unupgraded run behaves exactly as it did before
// progression existed. Consumers read through `get` every time rather than caching: invariant
// 14 means the value is a computation, and a cached copy is a stale copy the moment an
// upgrade lands.

export class Stats {
  private readonly blocks: Readonly<Record<StatId, StatBlock>> = {
    [StatId.MOVE_SPEED]: new StatBlock(BALANCE.player.speed),
    [StatId.WEAPON_DAMAGE]: new StatBlock(BALANCE.weapon.damage),
    [StatId.WEAPON_COOLDOWN]: new StatBlock(BALANCE.weapon.cooldownSeconds),
    [StatId.WEAPON_RANGE]: new StatBlock(BALANCE.weapon.range),
    [StatId.MAGNET_RADIUS]: new StatBlock(BALANCE.gem.magnetRadius),
  };

  public get(id: StatId): number {
    return this.blocks[id].value;
  }

  public add(id: StatId, modifier: Modifier): void {
    this.blocks[id].add(modifier);
  }

  /** How many times an upgrade has been taken, so offers can respect its stack cap. */
  public countFrom(id: StatId, source: string): number {
    return this.blocks[id].countFrom(source);
  }
}
