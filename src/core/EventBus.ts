// The only channel for communication that crosses an ownership boundary — system to
// system, or game to HUD. Portable TypeScript: no Phaser, no DOM.
//
// Payloads are positional primitives on purpose. If an event carried an entity, this file
// would have to name a type from `entities/`, which imports Phaser, and invariant 1 would
// leak in through the type graph. Keeping payloads primitive is also what stops HUDScene
// from ever holding a Player.

/**
 * Event name to payload tuple. Every bus event in the game is declared here.
 *
 * A type alias rather than an interface: only aliases get the implicit index signature that
 * lets them satisfy `EventMap`.
 */
export type GameEvents = {
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
};

export type EventMap = Record<string, readonly unknown[]>;

export type Listener<TArgs extends readonly unknown[]> = (...args: TArgs) => void;

/**
 * A listener whose parameters are `never`, which every concrete listener is assignable to.
 * Used as the storage type so one Map can hold listeners of differing signatures without
 * `any` appearing anywhere.
 */
type StoredListener = (...args: never[]) => void;

export class EventBus<TEvents extends EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<StoredListener>>();

  public on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    throw new Error('not implemented');
  }

  public off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): void {
    throw new Error('not implemented');
  }

  public emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): void {
    throw new Error('not implemented');
  }

  /** Drops every listener. Called on scene shutdown so a restart cannot double-subscribe. */
  public clear(): void {
    throw new Error('not implemented');
  }

  public listenerCount(event: keyof TEvents): number {
    throw new Error('not implemented');
  }
}

/**
 * The single bus the game runs on. A singleton because GameScene and HUDScene must share
 * one instance and neither may hold a reference to the other; GameScene owns its lifetime
 * and calls `clear()` on shutdown.
 */
export const eventBus = new EventBus<GameEvents>();
