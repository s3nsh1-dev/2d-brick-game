import type { Stats } from '../components/Stats';
import { BALANCE } from '../constants/balance';
import type { EventBus, GameEvents } from '../core/EventBus';
import { levelForXp } from '../core/xpCurve';
import type { UpgradeData, UpgradeDefinition } from '../data/schema';
import type { System } from './System';

// Levels and upgrades. Turns the XP total PickupSystem publishes into levels, offers three
// upgrades when one is reached, and applies whichever the player picks.
//
// Every `Math.random` this stage adds is in this file, which is the point: the Stage 3
// seeding pass wants a countable set of call sites, all inside systems. There is exactly
// one, in `pickOffers`.
//
// The scenes do the pausing. This system does not know that an `UpgradeScene` exists — it
// announces a level and waits for an id to come back, which is the same shape as every other
// cross-boundary conversation in the game.

export class ProgressionSystem implements System {
  private level = 1;

  /** Refilled per level-up, never reassigned, so the array itself is allocated once. */
  private readonly candidates: UpgradeDefinition[] = [];

  private readonly byId = new Map<string, UpgradeDefinition>();

  private readonly handleXpChanged = (total: number): void => {
    const earned = levelForXp(total, BALANCE.progression.xp);
    if (earned <= this.level) {
      return;
    }

    // One offer per level-up event even if a single gem crossed two thresholds, which the
    // current curve cannot produce but a cheaper one could. Taking the highest level is the
    // honest reading: the player is that level now.
    this.level = earned;

    const offers = this.pickOffers();
    const [first, second, third] = offers;
    if (first === undefined || second === undefined || third === undefined) {
      // Fewer eligible upgrades than the scene can show. Everything is capped out, so the
      // run simply continues rather than opening an empty menu.
      return;
    }

    this.bus.emit('level:up', this.level, first.id, second.id, third.id);
  };

  private readonly handleUpgradeChosen = (upgradeId: string): void => {
    const upgrade = this.byId.get(upgradeId);
    if (upgrade === undefined) {
      return;
    }

    // No cast: the schema validates `stat` and `kind` as enums over the shared vocabularies,
    // so zod has already narrowed them to exactly the types `Stats.add` accepts.
    this.stats.add(upgrade.stat, {
      source: upgrade.id,
      kind: upgrade.kind,
      amount: upgrade.amount,
    });
  };

  public constructor(
    private readonly stats: Stats,
    upgrades: UpgradeData,
    private readonly bus: EventBus<GameEvents>,
  ) {
    for (const upgrade of upgrades.upgrades) {
      this.byId.set(upgrade.id, upgrade);
    }

    this.bus.on('xp:changed', this.handleXpChanged);
    this.bus.on('upgrade:chosen', this.handleUpgradeChosen);
  }

  /** 1-based, for display. */
  public get currentLevel(): number {
    return this.level;
  }

  /**
   * Nothing to advance by time: levels are driven by an event, not by a clock. The method
   * exists because `System` requires it, and an empty one is more honest than inventing
   * per-frame work for this system to do.
   */
  public update(_dt: number): void {
    // Intentionally empty.
  }

  public destroy(): void {
    this.bus.off('xp:changed', this.handleXpChanged);
    this.bus.off('upgrade:chosen', this.handleUpgradeChosen);
  }

  /**
   * Three distinct upgrades, weighted, skipping anything already at its stack cap.
   *
   * Weighted without replacement: pick against the running total, remove, repeat. With six
   * upgrades this is cheaper and far easier to read than a shuffle.
   */
  private pickOffers(): UpgradeDefinition[] {
    this.candidates.length = 0;
    for (const upgrade of this.byId.values()) {
      if (this.stats.countFrom(upgrade.stat, upgrade.id) < upgrade.maxStacks) {
        this.candidates.push(upgrade);
      }
    }

    const offers: UpgradeDefinition[] = [];
    for (let i = 0; i < BALANCE.progression.offerCount && this.candidates.length > 0; i += 1) {
      let totalWeight = 0;
      for (const candidate of this.candidates) {
        totalWeight += candidate.weight;
      }

      let roll = Math.random() * totalWeight;
      let chosenIndex = this.candidates.length - 1;
      for (let index = 0; index < this.candidates.length; index += 1) {
        roll -= this.candidates[index]?.weight ?? 0;
        if (roll <= 0) {
          chosenIndex = index;
          break;
        }
      }

      const chosen = this.candidates[chosenIndex];
      if (chosen === undefined) {
        break;
      }

      offers.push(chosen);
      this.candidates.splice(chosenIndex, 1);
    }

    return offers;
  }
}
