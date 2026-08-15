import { describe, expect, it } from 'vitest';
import {
  levelForXp,
  levelProgress,
  totalXpForLevel,
  xpToAdvance,
  type XpCurveSpec,
} from '../core/xpCurve';

// §8 asks for two properties specifically: monotonic, and no off-by-one at level boundaries.
// The boundary block below is the second of those, checked from both sides of every edge.

const SPEC: XpCurveSpec = { firstLevelCost: 5, costGrowth: 3 };

describe('xpToAdvance', () => {
  it('charges the first-level cost to leave level 1', () => {
    expect(xpToAdvance(1, SPEC)).toBe(5);
  });

  it('adds the growth for each level after the first', () => {
    expect(xpToAdvance(2, SPEC)).toBe(8);
    expect(xpToAdvance(3, SPEC)).toBe(11);
  });

  it('treats a nonsense level as the first, rather than returning a negative cost', () => {
    expect(xpToAdvance(0, SPEC)).toBe(5);
    expect(xpToAdvance(-4, SPEC)).toBe(5);
  });
});

describe('totalXpForLevel', () => {
  it('costs nothing to be level 1, where every run starts', () => {
    expect(totalXpForLevel(1, SPEC)).toBe(0);
    expect(totalXpForLevel(0, SPEC)).toBe(0);
  });

  it('accumulates the per-level costs', () => {
    expect(totalXpForLevel(2, SPEC)).toBe(5);
    expect(totalXpForLevel(3, SPEC)).toBe(13);
    expect(totalXpForLevel(4, SPEC)).toBe(24);
  });

  it('matches the running sum of xpToAdvance, so the closed form is the same curve', () => {
    let running = 0;
    for (let level = 1; level <= 40; level += 1) {
      expect(totalXpForLevel(level, SPEC)).toBe(running);
      running += xpToAdvance(level, SPEC);
    }
  });

  it('is strictly monotonic', () => {
    for (let level = 1; level < 60; level += 1) {
      expect(totalXpForLevel(level + 1, SPEC)).toBeGreaterThan(totalXpForLevel(level, SPEC));
    }
  });
});

describe('levelForXp', () => {
  it('starts a run at level 1', () => {
    expect(levelForXp(0, SPEC)).toBe(1);
  });

  it('never drops below level 1, even for nonsense input', () => {
    expect(levelForXp(-100, SPEC)).toBe(1);
  });

  it('is monotonic in xp', () => {
    let previous = 1;
    for (let xp = 0; xp < 500; xp += 1) {
      const level = levelForXp(xp, SPEC);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  describe('boundaries', () => {
    it('levels up exactly on the threshold, not one xp late', () => {
      for (let level = 2; level <= 30; level += 1) {
        const threshold = totalXpForLevel(level, SPEC);

        expect(levelForXp(threshold - 1, SPEC)).toBe(level - 1);
        expect(levelForXp(threshold, SPEC)).toBe(level);
      }
    });

    it('round-trips every level through its own threshold', () => {
      for (let level = 1; level <= 30; level += 1) {
        expect(levelForXp(totalXpForLevel(level, SPEC), SPEC)).toBe(level);
      }
    });

    it('holds the level across the whole span between thresholds', () => {
      const start = totalXpForLevel(4, SPEC);
      const next = totalXpForLevel(5, SPEC);

      for (let xp = start; xp < next; xp += 1) {
        expect(levelForXp(xp, SPEC)).toBe(4);
      }
    });
  });
});

describe('levelProgress', () => {
  it('is 0 exactly on a level threshold', () => {
    expect(levelProgress(totalXpForLevel(3, SPEC), SPEC)).toBe(0);
  });

  it('approaches 1 just before the next threshold', () => {
    const next = totalXpForLevel(4, SPEC);

    expect(levelProgress(next - 1, SPEC)).toBeGreaterThan(0.8);
    expect(levelProgress(next - 1, SPEC)).toBeLessThan(1);
  });

  it('stays inside 0–1 across a long run', () => {
    for (let xp = 0; xp < 400; xp += 7) {
      const progress = levelProgress(xp, SPEC);
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(1);
    }
  });
});
