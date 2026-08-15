import { z } from 'zod';
import { BALANCE } from '../constants/balance';

// What the player is allowed to change. Portable TypeScript: no Phaser, no DOM.
//
// This file imports `constants/balance` — the only `core/` file that does. The alternative
// was a second copy of the three default volumes living here and drifting from the ones the
// audio system actually starts at. `constants/` holds no logic and imports nothing, so the
// portability invariant is untouched: this still runs in a bare Node test.
//
// The store carries a `revision` rather than an event of its own. A consumer that has to
// react to a change compares one integer; a consumer that reads live — most of them — needs
// nothing at all.

export const settingsSchema = z.strictObject({
  masterVolume: z.number().min(0).max(1),
  sfxVolume: z.number().min(0).max(1),
  musicVolume: z.number().min(0).max(1),
  /** Removes screen shake, damage flashes and hit-stop, and damps particle counts. */
  reducedMotion: z.boolean(),
  /** Repaints the enemy types onto an axis that survives a red-green deficiency. */
  colourblind: z.boolean(),
});

export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: BALANCE.audio.masterVolume,
  sfxVolume: BALANCE.audio.sfxVolume,
  musicVolume: BALANCE.audio.musicVolume,
  // Both accessibility options default to off, because both *remove* something. An option
  // that is on by default is a design decision imposed on everyone; one that is off is an
  // option. Hit-stop in particular changes timing, so its absence must be the player's choice.
  reducedMotion: false,
  colourblind: false,
};

export class SettingsStore {
  private current: Settings;
  private currentRevision = 0;

  public constructor(initial: Settings = DEFAULT_SETTINGS) {
    this.current = { ...initial };
  }

  /** Read live. Cheap enough to call per effect; there is no copy here. */
  public get(): Readonly<Settings> {
    return this.current;
  }

  /**
   * Bumped on every accepted change, so a consumer holding derived state — the audio system
   * holds one volume per Sound instance — can notice without subscribing to anything.
   */
  public get revision(): number {
    return this.currentRevision;
  }

  /** Replaces the whole record. Invalid values are rejected in favour of the current one. */
  public replace(next: Settings): void {
    const parsed = settingsSchema.safeParse(next);
    if (!parsed.success) {
      return;
    }

    this.current = parsed.data;
    this.currentRevision += 1;
  }

  /** Changes one field. Anything the schema rejects leaves the store untouched. */
  public set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.replace({ ...this.current, [key]: value });
  }
}
