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
  /**
   * Every wave has been announced and every scheduled spawn has been issued.
   *
   * Not the end of the run: the last enemies are still walking in. `CombatSystem` owns the
   * decision about when a cleared board becomes a win, because it owns the deaths.
   */
  'waves:cleared': [];
  /**
   * The run is over. Carries the final stats GameOverScene displays, and whether the player
   * finished the last wave or was finished by it.
   */
  'run:ended': [waveReached: number, xpTotal: number, victory: boolean];

  // Presentation events. Nothing in the gameplay path listens to any of these — they exist
  // so AudioSystem and VfxSystem can react without gameplay knowing either exists.
  //
  // Each fires at most a few times a second: `weapon:fired` is bounded by the weapon
  // cooldown, `enemy:damaged` by the projectiles that cooldown produces, `player:damaged`
  // by the per-enemy contact interval. That is why they are safe on a bus whose `emit`
  // allocates a rest-argument array, and why the collision callbacks next to them are still
  // direct calls: those fire per contact per frame.

  /**
   * An enemy entered the world at this position, which is on the ring *outside* the arena.
   *
   * Emitted for the telegraph and nothing else: `VfxSystem` marks the wall the enemy is
   * about to cross. Bounded by the spawn intervals in `waves.json`, which are the slowest
   * clocks in the game — the busiest wave emits this a handful of times a second.
   */
  'enemy:spawned': [x: number, y: number];
  /** An enemy took damage at this position. */
  'enemy:damaged': [x: number, y: number, amount: number];
  /** The player took damage at this position. */
  'player:damaged': [x: number, y: number, amount: number];
  /** A projectile left the weapon at this position. */
  'weapon:fired': [x: number, y: number];
  /** A gem was picked up at this position. */
  'gem:collected': [x: number, y: number];
  /** A health pickup was taken at this position. */
  'pickup:health': [x: number, y: number];

  /**
   * The player reached a new level, and these are the upgrades on offer.
   *
   * The offers are three positional ids rather than an array because pick-1-of-3 is the
   * design, not a parameter, and because an array payload would be one allocation per level
   * on a bus whose whole point is that payloads are primitives.
   */
  'level:up': [level: number, offerA: string, offerB: string, offerC: string];
  /** The player picked one of the offers. Carries the upgrade id. */
  'upgrade:chosen': [upgradeId: string];
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
