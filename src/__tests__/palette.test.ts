import { describe, expect, it } from 'vitest';
import { BALANCE } from '../constants/balance';
import { relativeLuminance } from '../core/color';
import enemies from '../data/enemies.json';

// The Stage 3 brief asks for a palette test so that "a missing colour is a failing test
// rather than a black square in one mode".
//
// It asks for that as key-set equality between two themes. This palette is not shaped that
// way: the colourblind option overrides the *enemy* colours only, because that is the axis
// the brief itself identifies as broken — red, pink and purple, which is the worst possible
// separation for the most common deficiency. So the equivalent guarantees are tested
// instead, and they are stronger: every colour is a real colour, there is one variant entry
// per enemy type, and the variant is separable by luminance alone.

describe('palette', () => {
  it('resolves every key to a valid 24-bit colour', () => {
    for (const [name, value] of Object.entries(BALANCE.palette)) {
      if (Array.isArray(value)) {
        continue;
      }

      expect(typeof value, name).toBe('number');
      expect(value, name).toBeGreaterThanOrEqual(0);
      expect(value, name).toBeLessThanOrEqual(0xffffff);
      expect(Number.isInteger(value), name).toBe(true);
    }
  });

  it('has no duplicate entries hiding a copy-paste', () => {
    // Narrowed by a loop rather than a filtered predicate: `BALANCE` is `as const`, so each
    // entry's type is its own literal and a `value is number` predicate is not assignable to
    // it. This is the same literal-type trap `docs/STATUS.md` records for class fields.
    const named: number[] = [];
    for (const value of Object.values(BALANCE.palette)) {
      if (typeof value === 'number') {
        named.push(value);
      }
    }

    // The player body and the UI accent are the same colour on purpose: the thing you
    // control and the thing you should press are one idea. Everything else is distinct.
    const deliberateDuplicates = 1;

    expect(named.length - new Set(named).size).toBe(deliberateDuplicates);
  });
});

describe('colourblind enemy palette', () => {
  const variant = BALANCE.palette.colourblindEnemies;

  it('covers every enemy type the content defines', () => {
    expect(variant.length).toBeGreaterThanOrEqual(enemies.enemies.length);
  });

  it('separates every pair by luminance, which no deficiency can collapse', () => {
    const luminances = enemies.enemies.map((_, index) =>
      relativeLuminance(variant[index] ?? 0),
    );

    for (let a = 0; a < luminances.length; a += 1) {
      for (let b = a + 1; b < luminances.length; b += 1) {
        const gap = Math.abs((luminances[a] ?? 0) - (luminances[b] ?? 0));
        expect(gap, `types ${String(a)} and ${String(b)}`).toBeGreaterThan(0.15);
      }
    }
  });

  it('stays clear of the player, the projectile and the gem', () => {
    const reserved = [
      BALANCE.palette.playerBody,
      BALANCE.palette.projectile,
      BALANCE.palette.gem,
    ];

    for (const [index] of enemies.enemies.entries()) {
      const colour = variant[index] ?? 0;
      for (const taken of reserved) {
        expect(colour, `enemy ${String(index)}`).not.toBe(taken);
      }
    }
  });

  it('actually differs from the default colours it replaces', () => {
    for (const [index, enemy] of enemies.enemies.entries()) {
      const original = Number.parseInt(enemy.color.slice(1), 16);
      expect(variant[index], enemy.id).not.toBe(original);
    }
  });
});
