// One upgradeable number. Portable TypeScript: no Phaser, no DOM.
//
// Invariant 14: stats are computed, never mutated. The base is immutable and every read
// recomputes from it, so removing a modifier restores the exact original value — there is no
// accumulator to drift. Anything that "applied" an upgrade by writing back into the base
// would lose that property on the first float that does not round-trip.

export const ModifierKind = {
  /** Added to the base before any multiplier applies. */
  FLAT: 'flat',
  /** A fraction added to the total multiplier: 0.25 is +25%, -0.15 is −15%. */
  MULTIPLIER: 'multiplier',
} as const;

export type ModifierKind = (typeof ModifierKind)[keyof typeof ModifierKind];

export interface Modifier {
  /** What applied this — an upgrade id. Removal and stack counting are by source. */
  readonly source: string;
  readonly kind: ModifierKind;
  readonly amount: number;
}

export class StatBlock {
  private readonly modifiers: Modifier[] = [];

  public constructor(public readonly base: number) {}

  /**
   * Flats first, then multipliers, and multipliers sum rather than compounding.
   *
   * Two +25% upgrades give +50%, not +56.25%. Summing is the honest reading of "+25%" on an
   * upgrade card, and it keeps stacking linear enough to reason about while tuning.
   */
  public get value(): number {
    let flat = this.base;
    let multiplier = 1;

    for (const modifier of this.modifiers) {
      if (modifier.kind === ModifierKind.FLAT) {
        flat += modifier.amount;
      } else {
        multiplier += modifier.amount;
      }
    }

    // A stat driven below zero by its modifiers is always a bug in the content, but it would
    // surface as an enemy walking backwards rather than as an error. Clamped here instead.
    return Math.max(0, flat * multiplier);
  }

  public get modifierCount(): number {
    return this.modifiers.length;
  }

  public add(modifier: Modifier): void {
    this.modifiers.push(modifier);
  }

  /** Removes one modifier from `source`. Returns false when there was none to remove. */
  public remove(source: string): boolean {
    const index = this.modifiers.findIndex((modifier) => modifier.source === source);
    if (index === -1) {
      return false;
    }

    this.modifiers.splice(index, 1);
    return true;
  }

  /** How many times `source` has been applied. Upgrades use this to cap their stacks. */
  public countFrom(source: string): number {
    let count = 0;
    for (const modifier of this.modifiers) {
      if (modifier.source === source) {
        count += 1;
      }
    }
    return count;
  }
}
