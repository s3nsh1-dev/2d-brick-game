// The only channel for communication that crosses an ownership boundary — system to
// system, or game to HUD. Portable TypeScript: no Phaser, no DOM.
//
// Payloads are positional primitives on purpose. If an event carried an entity, this file
// would have to name a type from `entities/`, which imports Phaser, and invariant 1 would
// leak in through the type graph. Keeping payloads primitive is also what stops HUDScene
// from ever holding a Player.

/** Event name to payload tuple. Every bus event in the game is declared here. */
export interface GameEvents {
  /** A wave began. Carries the 1-based wave number. */
  'wave:started': [waveNumber: number];
  /** The player's health changed, by damage or by a run restarting. */
  'player:health-changed': [current: number, max: number];
  /** An enemy died at this position. PickupSystem turns it into a gem. */
  'enemy:died': [x: number, y: number];
  /** The player's XP total changed. */
  'xp:changed': [total: number];
  /** The run is over. Carries the final stats GameOverScene displays. */
  'run:ended': [waveReached: number, xpTotal: number];
}

/**
 * The constraint an event map must satisfy, written against its own keys.
 *
 * The obvious spelling — `Record<string, readonly unknown[]>` — quietly forces every event
 * map to be a type alias, because only aliases get an implicit index signature. Phrasing it
 * as `keyof T` lets a plain `interface` satisfy it, which is what `GameEvents` above is.
 */
export type EventMap<T> = Record<keyof T, readonly unknown[]>;

export type Listener<TArgs extends readonly unknown[]> = (...args: TArgs) => void;

/**
 * Storage, keyed by event name so each Set remembers the exact signature it holds.
 *
 * A `Map<keyof TEvents, Set<SomeWidenedListener>>` would need a cast in `emit` to narrow a
 * listener back to its payload; a partial mapped type carries that relationship in the type
 * itself, so this class contains no assertions at all.
 */
type ListenerMap<TEvents extends EventMap<TEvents>> = {
  [K in keyof TEvents]?: Set<Listener<TEvents[K]>>;
};

export class EventBus<TEvents extends EventMap<TEvents>> {
  private listeners: ListenerMap<TEvents> = {};

  public on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    let set = this.listeners[event];
    if (set === undefined) {
      set = new Set<Listener<TEvents[K]>>();
      this.listeners[event] = set;
    }

    // A Set, so subscribing the same function twice still delivers once.
    set.add(listener);
  }

  public off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    this.listeners[event]?.delete(listener);
  }

  public emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    const set = this.listeners[event];
    if (set === undefined) {
      return;
    }

    // Iterated directly rather than through a copy, so dispatch allocates nothing. Deleting
    // from a Set mid-iteration is well defined in JS, which is what a listener that
    // unsubscribes itself during shutdown relies on.
    for (const listener of set) {
      listener(...args);
    }
  }

  /** Drops every listener. Called on scene shutdown so a restart cannot double-subscribe. */
  public clear(): void {
    this.listeners = {};
  }

  public listenerCount(event: keyof TEvents): number {
    return this.listeners[event]?.size ?? 0;
  }
}

/**
 * The single bus the game runs on. A singleton because GameScene and HUDScene must share
 * one instance and neither may hold a reference to the other; GameScene owns its lifetime
 * and calls `clear()` on shutdown.
 */
export const eventBus = new EventBus<GameEvents>();
