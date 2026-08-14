// How much XP a level costs. Portable TypeScript: no Phaser, no DOM.
//
// The shape is arithmetic rather than exponential: each level costs a fixed amount more than
// the one before it. Gems are worth 1 and arrive roughly in proportion to how many enemies a
// wave sends, so a curve that doubled would stop producing upgrades exactly when the waves
// start needing them.
//
// The numbers live in `balance.ts` and arrive as a spec, the same way the audio synthesis
// takes its tones. That is what keeps this file pure and testable.

export interface XpCurveSpec {
  /** XP to go from level 1 to level 2. */
  readonly firstLevelCost: number;
  /** Added to the cost of every level after the first. */
  readonly costGrowth: number;
}

/** XP required to go from `level` to the next one. Levels are 1-based. */
export function xpToAdvance(level: number, spec: XpCurveSpec): number {
  if (level < 1) {
    return spec.firstLevelCost;
  }

  return spec.firstLevelCost + spec.costGrowth * (level - 1);
}

/**
 * Cumulative XP required to have reached `level`.
 *
 * Level 1 costs nothing, which is the off-by-one this function exists to get right: a run
 * starts at level 1 with 0 XP, so the first threshold is the cost of level 2 and not of 1.
 */
export function totalXpForLevel(level: number, spec: XpCurveSpec): number {
  if (level <= 1) {
    return 0;
  }

  // Closed form of the sum of `xpToAdvance` over 1..level-1, so this stays O(1) however far
  // a run gets.
  const steps = level - 1;
  return steps * spec.firstLevelCost + (spec.costGrowth * steps * (steps - 1)) / 2;
}

/** The level a total XP amount has earned. Never below 1. */
export function levelForXp(totalXp: number, spec: XpCurveSpec): number {
  let level = 1;

  // Walks up rather than inverting the quadratic: the arithmetic is exact at every step,
  // where a square root would need rounding decisions right on the level boundaries — which
  // is precisely where an off-by-one would hide.
  while (totalXp >= totalXpForLevel(level + 1, spec)) {
    level += 1;
  }

  return level;
}

/** How far into the current level a total sits, as 0–1. For a progress bar. */
export function levelProgress(totalXp: number, spec: XpCurveSpec): number {
  const level = levelForXp(totalXp, spec);
  const earned = totalXp - totalXpForLevel(level, spec);
  const needed = xpToAdvance(level, spec);

  return needed <= 0 ? 0 : Math.min(1, earned / needed);
}
