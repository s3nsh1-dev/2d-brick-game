// Vector and geometry helpers. Portable TypeScript: no Phaser, no DOM.
//
// Every function that produces a vector writes into a caller-supplied target rather than
// returning a new one, so per-frame code allocates nothing. The scratch vectors below
// exist so callers do not have to hold their own.

export interface Vec2 {
  x: number;
  y: number;
}

/** Anything with a position. Phaser sprites satisfy this structurally, with no import. */
export interface Positioned {
  readonly x: number;
  readonly y: number;
}

/** Shared write targets for per-frame math. Never hold a reference across a frame. */
export const scratchA: Vec2 = { x: 0, y: 0 };
export const scratchB: Vec2 = { x: 0, y: 0 };

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/**
 * Writes the vector (x, y) rescaled to `length` into `out`. A zero-length input writes
 * (0, 0), which is what callers want for "no input" and "already on top of the target".
 */
export function setLength(out: Vec2, x: number, y: number, length: number): Vec2 {
  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }

  const scale = length / magnitude;
  out.x = x * scale;
  out.y = y * scale;
  return out;
}

/**
 * The closest candidate within `maxDistance`, or undefined if none qualify.
 * Compares squared distances, so no square roots are taken in the search.
 */
export function nearest<T extends Positioned>(
  fromX: number,
  fromY: number,
  candidates: readonly T[],
  maxDistance: number,
): T | undefined {
  const maxDistanceSquared = maxDistance * maxDistance;
  let best: T | undefined;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateDistance = distanceSquared(fromX, fromY, candidate.x, candidate.y);
    if (candidateDistance <= maxDistanceSquared && candidateDistance < bestDistanceSquared) {
      bestDistanceSquared = candidateDistance;
      best = candidate;
    }
  }

  return best;
}
