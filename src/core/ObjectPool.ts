// Fixed-capacity object pool. Portable TypeScript: no Phaser, no DOM.
//
// Every object is constructed up front, in the pool's constructor. That is the point —
// invariant 6 forbids `new` inside any update path, and a pool that allocates lazily on
// first acquire only moves the allocation, it does not remove it.

export class ObjectPool<T> {
  private readonly free: T[] = [];
  private readonly activeItems: T[] = [];

  /**
   * @param capacity  How many objects to construct. `acquire` returns undefined beyond it.
   * @param create    Builds one object. Must return it in its inactive/released state.
   * @param reset     Returns an object to its inactive state. Called on every release.
   */
  public constructor(
    public readonly capacity: number,
    create: () => T,
    private readonly reset: (item: T) => void,
  ) {
    for (let i = 0; i < capacity; i += 1) {
      this.free.push(create());
    }
  }

  /**
   * The live objects, in no meaningful order.
   *
   * Do not mutate. `release` swap-removes, so a caller that releases while iterating must
   * walk this backwards or it will skip an element.
   */
  public get active(): readonly T[] {
    return this.activeItems;
  }

  public get activeCount(): number {
    return this.activeItems.length;
  }

  public get freeCount(): number {
    return this.free.length;
  }

  /** Takes an object from the pool, or undefined when the pool is exhausted. */
  public acquire(): T | undefined {
    throw new Error('not implemented');
  }

  /** Resets an object and returns it to the pool. Releasing a free object is a no-op. */
  public release(item: T): void {
    throw new Error('not implemented');
  }

  /** Releases every active object. Called on scene shutdown. */
  public releaseAll(): void {
    throw new Error('not implemented');
  }
}
