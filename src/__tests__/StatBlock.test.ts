import { describe, expect, it } from 'vitest';
import { ModifierKind, StatBlock } from '../core/StatBlock';

// Invariant 14 in test form: stats are computed, never mutated. The round-trip cases are the
// point of the file — an implementation that wrote modifiers back into a running total would
// pass the stacking tests and fail these.

describe('StatBlock', () => {
  it('is its base with no modifiers', () => {
    expect(new StatBlock(100).value).toBe(100);
  });

  it('adds flat modifiers', () => {
    const block = new StatBlock(10);

    block.add({ source: 'a', kind: ModifierKind.FLAT, amount: 5 });

    expect(block.value).toBe(15);
  });

  it('applies a multiplier as a fraction added to 1', () => {
    const block = new StatBlock(100);

    block.add({ source: 'a', kind: ModifierKind.MULTIPLIER, amount: 0.25 });

    expect(block.value).toBe(125);
  });

  it('sums multipliers rather than compounding them', () => {
    const block = new StatBlock(100);

    block.add({ source: 'a', kind: ModifierKind.MULTIPLIER, amount: 0.25 });
    block.add({ source: 'b', kind: ModifierKind.MULTIPLIER, amount: 0.25 });

    // +50%, not +56.25%. Two "+25%" cards should read as fifty.
    expect(block.value).toBe(150);
  });

  it('applies flats before multipliers, whatever order they arrived in', () => {
    const multiplierFirst = new StatBlock(10);
    multiplierFirst.add({ source: 'm', kind: ModifierKind.MULTIPLIER, amount: 1 });
    multiplierFirst.add({ source: 'f', kind: ModifierKind.FLAT, amount: 10 });

    const flatFirst = new StatBlock(10);
    flatFirst.add({ source: 'f', kind: ModifierKind.FLAT, amount: 10 });
    flatFirst.add({ source: 'm', kind: ModifierKind.MULTIPLIER, amount: 1 });

    expect(multiplierFirst.value).toBe(40);
    expect(flatFirst.value).toBe(40);
  });

  it('handles a negative multiplier, which is how cooldown upgrades work', () => {
    const block = new StatBlock(0.32);

    block.add({ source: 'quick', kind: ModifierKind.MULTIPLIER, amount: -0.15 });

    expect(block.value).toBeCloseTo(0.272, 10);
  });

  it('never returns a negative value', () => {
    const block = new StatBlock(10);

    block.add({ source: 'a', kind: ModifierKind.MULTIPLIER, amount: -5 });

    expect(block.value).toBe(0);
  });

  describe('round-trips', () => {
    it('restores the exact base after add-then-remove', () => {
      const block = new StatBlock(0.32);

      block.add({ source: 'quick', kind: ModifierKind.MULTIPLIER, amount: -0.15 });
      block.remove('quick');

      // Exact equality, deliberately: recomputing from an immutable base cannot drift, and
      // `toBeCloseTo` here would hide the very failure this test exists to catch.
      expect(block.value).toBe(0.32);
    });

    it('restores the exact base after many adds and removes', () => {
      const block = new StatBlock(37.5);
      const sources = ['a', 'b', 'c', 'd', 'e'];

      for (const source of sources) {
        block.add({ source, kind: ModifierKind.MULTIPLIER, amount: 0.1 });
        block.add({ source, kind: ModifierKind.FLAT, amount: 0.3 });
      }
      for (const source of sources) {
        block.remove(source);
        block.remove(source);
      }

      expect(block.value).toBe(37.5);
      expect(block.modifierCount).toBe(0);
    });

    it('removes one stack at a time', () => {
      const block = new StatBlock(100);

      block.add({ source: 'a', kind: ModifierKind.FLAT, amount: 10 });
      block.add({ source: 'a', kind: ModifierKind.FLAT, amount: 10 });
      block.remove('a');

      expect(block.value).toBe(110);
    });

    it('reports removing something it never had', () => {
      const block = new StatBlock(1);

      expect(block.remove('absent')).toBe(false);
    });
  });

  describe('stack counting', () => {
    it('counts by source', () => {
      const block = new StatBlock(1);

      block.add({ source: 'a', kind: ModifierKind.FLAT, amount: 1 });
      block.add({ source: 'a', kind: ModifierKind.FLAT, amount: 1 });
      block.add({ source: 'b', kind: ModifierKind.FLAT, amount: 1 });

      expect(block.countFrom('a')).toBe(2);
      expect(block.countFrom('b')).toBe(1);
      expect(block.countFrom('c')).toBe(0);
    });
  });
});
