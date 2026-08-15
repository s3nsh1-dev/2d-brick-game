import { describe, expect, it } from 'vitest';
import {
  EMPTY_SAVE,
  SAVE_KEY,
  SAVE_VERSION,
  SaveStore,
  type SaveData,
  type StorageAdapter,
} from '../core/SaveStore';
import { DEFAULT_SETTINGS, type Settings } from '../core/settings';

// The adapter is why this file needs no DOM and no `jsdom`: `vitest.config.ts` is
// `environment: 'node'`, and invariant 1 means anything in core/ has to pass there.
//
// §8 asks for five cases: round-trip, version migration, corrupt JSON, absent key, and
// quota-exceeded on write. All five are below.

class MemoryStorage implements StorageAdapter {
  public readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** Storage that is present but refuses every write, as a full quota does. */
class FullStorage extends MemoryStorage {
  public override setItem(): never {
    throw new DOMException('QuotaExceededError');
  }
}

/** Storage that throws on read too, as a browser with storage disabled does. */
class HostileStorage implements StorageAdapter {
  public getItem(): never {
    throw new Error('storage disabled');
  }

  public setItem(): never {
    throw new Error('storage disabled');
  }
}

const CHOSEN_SETTINGS: Settings = {
  masterVolume: 0.4,
  sfxVolume: 0.2,
  musicVolume: 0,
  reducedMotion: true,
  colourblind: true,
};

const FILLED: SaveData = {
  version: SAVE_VERSION,
  highScoreXp: 240,
  bestWave: 7,
  totalRuns: 12,
  settings: CHOSEN_SETTINGS,
};

describe('SaveStore', () => {
  describe('round-trip', () => {
    it('reads back exactly what it wrote', () => {
      const storage = new MemoryStorage();

      expect(new SaveStore(storage).save(FILLED)).toBe(true);
      expect(new SaveStore(storage).load()).toEqual(FILLED);
    });

    it('writes under its own key', () => {
      const storage = new MemoryStorage();

      new SaveStore(storage).save(FILLED);

      expect(storage.items.has(SAVE_KEY)).toBe(true);
    });

    it('stamps the current version', () => {
      const storage = new MemoryStorage();

      new SaveStore(storage).save(FILLED);

      expect(JSON.parse(storage.items.get(SAVE_KEY) ?? '{}')).toMatchObject({
        version: SAVE_VERSION,
      });
    });
  });

  describe('absent key', () => {
    it('returns the empty save when nothing has ever been written', () => {
      expect(new SaveStore(new MemoryStorage()).load()).toEqual(EMPTY_SAVE);
    });

    it('returns the empty save when there is no storage at all', () => {
      expect(new SaveStore(undefined).load()).toEqual(EMPTY_SAVE);
    });
  });

  describe('corrupt data', () => {
    it('survives a value that is not JSON', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, 'not json {{{');

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('survives JSON of the wrong shape', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, JSON.stringify({ hello: 'world' }));

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('survives a save with the right keys and wrong types', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: SAVE_VERSION, highScoreXp: 'lots', bestWave: 3, totalRuns: 1 }),
      );

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('rejects negative and fractional counters rather than trusting them', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: SAVE_VERSION, highScoreXp: -5, bestWave: 2.5, totalRuns: 1 }),
      );

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('survives a null value', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, 'null');

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('survives storage that throws on read', () => {
      expect(new SaveStore(new HostileStorage()).load()).toEqual(EMPTY_SAVE);
    });
  });

  describe('version migration', () => {
    it('brings a version 1 save forward, keeping its records', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, JSON.stringify({ version: 1, highScoreXp: 88, bestWave: 4 }));

      expect(new SaveStore(storage).load()).toEqual({
        version: SAVE_VERSION,
        highScoreXp: 88,
        bestWave: 4,
        totalRuns: 0,
        settings: DEFAULT_SETTINGS,
      });
    });

    // The v2 record is the first one that ever reached a real browser, so this is the first
    // migration that has to be right rather than merely written.
    it('brings a version 2 save forward, keeping every record it carried', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: 2, highScoreXp: 512, bestWave: 11, totalRuns: 37 }),
      );

      expect(new SaveStore(storage).load()).toEqual({
        version: SAVE_VERSION,
        highScoreXp: 512,
        bestWave: 11,
        totalRuns: 37,
        settings: DEFAULT_SETTINGS,
      });
    });

    it('never switches an accessibility option on during a migration', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: 2, highScoreXp: 1, bestWave: 1, totalRuns: 1 }),
      );

      const migrated = new SaveStore(storage).load();

      expect(migrated.settings.reducedMotion).toBe(false);
      expect(migrated.settings.colourblind).toBe(false);
    });

    it('persists a migrated save so the next boot reads v3 directly', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: 2, highScoreXp: 5, bestWave: 2, totalRuns: 3 }),
      );

      const store = new SaveStore(storage);
      store.saveSettings(store.load().settings);

      expect(JSON.parse(storage.items.get(SAVE_KEY) ?? '{}')).toMatchObject({
        version: SAVE_VERSION,
        totalRuns: 3,
      });
    });

    it('discards a save from a version it does not know', () => {
      const storage = new MemoryStorage();
      storage.items.set(
        SAVE_KEY,
        JSON.stringify({ version: 99, highScoreXp: 1, bestWave: 1, totalRuns: 1 }),
      );

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });

    it('discards a version 1 save that is itself malformed', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, JSON.stringify({ version: 1, highScoreXp: 'x' }));

      expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
    });
  });

  describe('quota exceeded', () => {
    it('reports a failed write instead of throwing', () => {
      expect(new SaveStore(new FullStorage()).save(FILLED)).toBe(false);
    });

    it('reports a failed write when there is no storage', () => {
      expect(new SaveStore(undefined).save(FILLED)).toBe(false);
    });

    it('still returns the updated record when the write fails', () => {
      const store = new SaveStore(new FullStorage());

      expect(store.recordRun(5, 100)).toEqual({
        version: SAVE_VERSION,
        highScoreXp: 100,
        bestWave: 5,
        totalRuns: 1,
        settings: DEFAULT_SETTINGS,
      });
    });
  });

  describe('recordRun', () => {
    it('counts every run', () => {
      const store = new SaveStore(new MemoryStorage());

      store.recordRun(1, 10);
      store.recordRun(1, 10);

      expect(store.load().totalRuns).toBe(2);
    });

    it('keeps the best of each record rather than the latest', () => {
      const store = new SaveStore(new MemoryStorage());

      store.recordRun(9, 500);
      const after = store.recordRun(2, 30);

      expect(after.bestWave).toBe(9);
      expect(after.highScoreXp).toBe(500);
    });

    it('improves a record when the run beats it', () => {
      const store = new SaveStore(new MemoryStorage());

      store.recordRun(3, 40);
      const after = store.recordRun(8, 410);

      expect(after.bestWave).toBe(8);
      expect(after.highScoreXp).toBe(410);
    });

    it('starts a record from a corrupt save rather than refusing to write', () => {
      const storage = new MemoryStorage();
      storage.items.set(SAVE_KEY, 'garbage');

      expect(new SaveStore(storage).recordRun(4, 60)).toEqual({
        version: SAVE_VERSION,
        highScoreXp: 60,
        bestWave: 4,
        totalRuns: 1,
        settings: DEFAULT_SETTINGS,
      });
    });

    it('never stores a fractional or negative run', () => {
      const store = new SaveStore(new MemoryStorage());

      const after = store.recordRun(-3, 12.7);

      expect(after.bestWave).toBe(0);
      expect(after.highScoreXp).toBe(12);
    });
  });
});

describe('settings persistence', () => {
  it('round-trips every option the player can change', () => {
    const storage = new MemoryStorage();

    new SaveStore(storage).saveSettings(CHOSEN_SETTINGS);

    expect(new SaveStore(storage).load().settings).toEqual(CHOSEN_SETTINGS);
  });

  it('leaves the records alone when only the settings change', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.save(FILLED);

    store.saveSettings(DEFAULT_SETTINGS);
    const after = store.load();

    expect(after.highScoreXp).toBe(FILLED.highScoreXp);
    expect(after.bestWave).toBe(FILLED.bestWave);
    expect(after.totalRuns).toBe(FILLED.totalRuns);
    expect(after.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('leaves the settings alone when only a run is recorded', () => {
    const storage = new MemoryStorage();
    const store = new SaveStore(storage);
    store.saveSettings(CHOSEN_SETTINGS);

    expect(store.recordRun(9, 300).settings).toEqual(CHOSEN_SETTINGS);
  });

  it('falls back to defaults when the stored settings are malformed', () => {
    const storage = new MemoryStorage();
    storage.items.set(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        highScoreXp: 1,
        bestWave: 1,
        totalRuns: 1,
        settings: { masterVolume: 'loud' },
      }),
    );

    // Neither a v3 record nor any older shape, so it is discarded whole rather than
    // half-read. A partially trusted save is worse than none.
    expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
  });

  it('rejects a volume outside 0-1 rather than storing it', () => {
    const storage = new MemoryStorage();
    storage.items.set(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        highScoreXp: 0,
        bestWave: 0,
        totalRuns: 0,
        settings: { ...DEFAULT_SETTINGS, masterVolume: 4 },
      }),
    );

    expect(new SaveStore(storage).load()).toEqual(EMPTY_SAVE);
  });
});
