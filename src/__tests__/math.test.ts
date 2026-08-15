import { describe, expect, it } from 'vitest';
import { clamp, distanceSquared, nearest, setLength, type Positioned, type Vec2 } from '../core/math';

function at(x: number, y: number): Positioned {
  return { x, y };
}

describe('clamp', () => {
  it('passes a value inside the range through', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below and above', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it('includes both bounds', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('distanceSquared', () => {
  it('is zero for a point against itself', () => {
    expect(distanceSquared(3, 4, 3, 4)).toBe(0);
  });

  it('returns the square, not the root', () => {
    expect(distanceSquared(0, 0, 3, 4)).toBe(25);
  });

  it('is direction independent', () => {
    expect(distanceSquared(-2, -2, 1, 2)).toBe(distanceSquared(1, 2, -2, -2));
  });
});

describe('setLength', () => {
  it('rescales to the requested length', () => {
    const out: Vec2 = { x: 0, y: 0 };

    setLength(out, 3, 4, 10);

    expect(out.x).toBeCloseTo(6);
    expect(out.y).toBeCloseTo(8);
  });

  it('writes into the target and returns it, so callers can allocate nothing', () => {
    const out: Vec2 = { x: 0, y: 0 };

    expect(setLength(out, 1, 0, 5)).toBe(out);
  });

  it('writes zero for a zero-length input rather than NaN', () => {
    const out: Vec2 = { x: 9, y: 9 };

    setLength(out, 0, 0, 100);

    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
  });

  it('preserves direction on the diagonal', () => {
    const out: Vec2 = { x: 0, y: 0 };

    setLength(out, 1, 1, 1);

    expect(out.x).toBeCloseTo(Math.SQRT1_2);
    expect(out.y).toBeCloseTo(Math.SQRT1_2);
  });
});

describe('nearest', () => {
  it('returns the closest candidate', () => {
    const far = at(100, 0);
    const close = at(10, 0);

    expect(nearest(0, 0, [far, close], 1000)).toBe(close);
  });

  it('ignores candidates beyond the range', () => {
    expect(nearest(0, 0, [at(500, 0)], 100)).toBeUndefined();
  });

  it('includes a candidate exactly at the range limit', () => {
    const edge = at(100, 0);

    expect(nearest(0, 0, [edge], 100)).toBe(edge);
  });

  it('returns undefined for no candidates', () => {
    // Annotated so T infers as Positioned; a bare [] infers never and the result stops
    // being a value expression.
    const none: Positioned[] = [];

    expect(nearest(0, 0, none, 100)).toBeUndefined();
  });

  it('measures from the given origin, not from zero', () => {
    const nearOrigin = at(5, 5);
    const nearTarget = at(95, 95);

    expect(nearest(100, 100, [nearOrigin, nearTarget], 1000)).toBe(nearTarget);
  });
});
