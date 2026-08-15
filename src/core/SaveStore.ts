import { z } from 'zod';
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from './settings';

// Persistent records across runs. Portable TypeScript: no Phaser, and — just as importantly
// — no DOM. Storage arrives as an adapter, which is what lets this be tested in a bare Node
// process against a Map instead of a browser.
//
// Invariant 15: every save carries a schema version, is validated with zod on read, is
// migrated when it can be and discarded when it cannot. Corrupt or foreign data in the save
// key must never take the boot sequence down — this is the one place in the codebase where
// `safeParse` is right and `parse` is wrong, because the input is not ours.

/** The slice of the Web Storage API this needs. `window.localStorage` satisfies it. */
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SAVE_KEY = 'arena.save';

/** Bump when the shape changes, and add a migration for the version being left behind. */
export const SAVE_VERSION = 3;

export const saveDataSchema = z.strictObject({
  version: z.literal(SAVE_VERSION),
  /** The most XP collected in a single run. */
  highScoreXp: z.number().int().nonnegative(),
  /** The furthest wave reached in a single run. */
  bestWave: z.number().int().nonnegative(),
  /** How many runs have been finished, ever. */
  totalRuns: z.number().int().nonnegative(),
  /** Volumes and accessibility toggles. Added in v3, when there was finally a UI for them. */
  settings: settingsSchema,
});

export type SaveData = z.infer<typeof saveDataSchema>;

/**
 * Version 1: the same record before it counted runs.
 *
 * It never shipped outside development. It is kept anyway because a migration path that has
 * never been exercised is not a migration path, and the alternative — discarding on every
 * future shape change — throws away the player's records the first time the file grows.
 */
const version1Schema = z.strictObject({
  version: z.literal(1),
  highScoreXp: z.number().int().nonnegative(),
  bestWave: z.number().int().nonnegative(),
});

/**
 * Version 2: the record as it shipped through Stage 2 — records but no settings.
 *
 * This is the first version that ever reached a player's browser, so this is the first
 * migration that has to be right. Stage 2 wrote the v1 path speculatively; this one is the
 * reason it was worth writing.
 */
const version2Schema = z.strictObject({
  version: z.literal(2),
  highScoreXp: z.number().int().nonnegative(),
  bestWave: z.number().int().nonnegative(),
  totalRuns: z.number().int().nonnegative(),
});

export const EMPTY_SAVE: SaveData = {
  version: SAVE_VERSION,
  highScoreXp: 0,
  bestWave: 0,
  totalRuns: 0,
  settings: DEFAULT_SETTINGS,
};

export class SaveStore {
  /**
   * @param storage Omitted when the environment has no usable storage — a browser with it
   * disabled throws on the property access itself, before this class is ever reached. Every
   * read then returns the empty save and every write is a no-op, which is the correct
   * behaviour for a record of past runs: the game is still perfectly playable without one.
   */
  public constructor(private readonly storage: StorageAdapter | undefined) {}

  /** Never throws. Anything unreadable, unparseable or unmigratable becomes the empty save. */
  public load(): SaveData {
    const raw = this.read();
    if (raw === null) {
      return EMPTY_SAVE;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not JSON at all: something else owns this key, or a write was torn.
      return EMPTY_SAVE;
    }

    const current = saveDataSchema.safeParse(parsed);
    if (current.success) {
      return current.data;
    }

    return migrate(parsed) ?? EMPTY_SAVE;
  }

  /** Returns false when the write did not land. Callers may ignore it; nothing depends on it. */
  public save(data: SaveData): boolean {
    if (this.storage === undefined) {
      return false;
    }

    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      // Quota exceeded, or storage disabled between construction and now. A lost record is
      // never worth interrupting a run over.
      return false;
    }
  }

  /**
   * Folds one finished run into the record and writes it back.
   *
   * Returns the updated save whether or not the write succeeded, so the caller can display
   * the run the player just had rather than the one that was last persisted.
   */
  public recordRun(waveReached: number, xpTotal: number): SaveData {
    const previous = this.load();
    const updated: SaveData = {
      version: SAVE_VERSION,
      highScoreXp: Math.max(previous.highScoreXp, Math.max(0, Math.floor(xpTotal))),
      bestWave: Math.max(previous.bestWave, Math.max(0, Math.floor(waveReached))),
      totalRuns: previous.totalRuns + 1,
      // Carried through untouched. Finishing a run must never rewrite what the player chose.
      settings: previous.settings,
    };

    this.save(updated);
    return updated;
  }

  /** Writes the settings back without touching the records beside them. */
  public saveSettings(settings: Settings): SaveData {
    const updated: SaveData = { ...this.load(), settings };

    this.save(updated);
    return updated;
  }

  private read(): string | null {
    if (this.storage === undefined) {
      return null;
    }

    try {
      return this.storage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  }
}

/**
 * Brings an older save forward, or returns undefined when it cannot.
 *
 * A save from a *newer* version than this build lands here too and is discarded: guessing at
 * a shape from the future is how a migration corrupts data rather than rescuing it.
 */
function migrate(parsed: unknown): SaveData | undefined {
  const fromV2 = version2Schema.safeParse(parsed);
  if (fromV2.success) {
    return {
      version: SAVE_VERSION,
      highScoreXp: fromV2.data.highScoreXp,
      bestWave: fromV2.data.bestWave,
      totalRuns: fromV2.data.totalRuns,
      // A v2 save predates the options screen, so the player never expressed a preference.
      // Defaults are the honest reading of "not chosen", and both accessibility toggles
      // default to off — a migration must never switch something on behind a player's back.
      settings: DEFAULT_SETTINGS,
    };
  }

  const fromV1 = version1Schema.safeParse(parsed);
  if (fromV1.success) {
    return {
      version: SAVE_VERSION,
      highScoreXp: fromV1.data.highScoreXp,
      bestWave: fromV1.data.bestWave,
      // Unknowable from a v1 save. Zero understates it, which is the safe direction for a
      // counter nothing else depends on.
      totalRuns: 0,
      settings: DEFAULT_SETTINGS,
    };
  }

  return undefined;
}
