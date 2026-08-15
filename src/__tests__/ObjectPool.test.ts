import { describe, expect, it, vi } from 'vitest';
import { ObjectPool } from '../core/ObjectPool';

interface Item {
  id: number;
  live: boolean;
}

function makePool(capacity: number): {
  pool: ObjectPool<Item>;
  create: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  let nextId = 0;
  const create = vi.fn((): Item => {
    nextId += 1;
    return { id: nextId, live: false };
  });
  const reset = vi.fn((item: Item): void => {
    item.live = false;
  });

  return { pool: new ObjectPool<Item>(capacity, create, reset), create, reset };
}

/** Narrows away the pool's `undefined` without the non-null assertion AGENTS.md restricts. */
function acquired<T>(item: T | undefined): T {
  if (item === undefined) {
    throw new Error('expected the pool to hand out an object');
  }
  return item;
}

describe('ObjectPool', () => {
  it('constructs every object up front, so no update path ever allocates', () => {
    const { pool, create } = makePool(5);

    expect(create).toHaveBeenCalledTimes(5);
    expect(pool.freeCount).toBe(5);
    expect(pool.activeCount).toBe(0);
  });

  it('moves objects from free to active on acquire', () => {
    const { pool } = makePool(3);

    const item = pool.acquire();

    expect(item).toBeDefined();
    expect(pool.activeCount).toBe(1);
    expect(pool.freeCount).toBe(2);
    expect(pool.active).toContain(item);
  });

  it('returns undefined once exhausted instead of growing', () => {
    const { pool } = makePool(2);

    pool.acquire();
    pool.acquire();

    expect(pool.acquire()).toBeUndefined();
    expect(pool.activeCount).toBe(2);
  });

  it('hands out distinct objects', () => {
    const { pool } = makePool(3);

    const first = pool.acquire();
    const second = pool.acquire();

    expect(first).not.toBe(second);
  });

  it('resets on release and makes the object available again', () => {
    const { pool, reset } = makePool(2);

    const item = acquired(pool.acquire());
    pool.release(item);

    expect(reset).toHaveBeenCalledWith(item);
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(2);
    expect(pool.acquire()).toBe(item);
  });

  it('ignores a release of an object that is already free', () => {
    const { pool, reset } = makePool(2);

    const item = acquired(pool.acquire());
    pool.release(item);
    pool.release(item);

    expect(reset).toHaveBeenCalledTimes(1);
    expect(pool.freeCount).toBe(2);
  });

  it('empties on releaseAll', () => {
    const { pool, reset } = makePool(4);

    pool.acquire();
    pool.acquire();
    pool.acquire();
    pool.releaseAll();

    expect(reset).toHaveBeenCalledTimes(3);
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(4);
  });

  // The documented iteration contract: release swap-removes, so a system walking `active`
  // backwards while releasing must still see every element exactly once.
  it('survives releasing every object while iterating active in reverse', () => {
    const { pool } = makePool(6);

    for (let i = 0; i < 6; i += 1) {
      acquired(pool.acquire()).live = true;
    }

    const seen: number[] = [];
    for (let i = pool.active.length - 1; i >= 0; i -= 1) {
      const item = acquired(pool.active[i]);
      seen.push(item.id);
      pool.release(item);
    }

    expect(seen).toHaveLength(6);
    expect(new Set(seen).size).toBe(6);
    expect(pool.activeCount).toBe(0);
  });

  it('reports its capacity', () => {
    const { pool } = makePool(7);

    expect(pool.capacity).toBe(7);
  });
});
