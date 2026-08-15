import { SettingsStore } from '../core/settings';
import { saveStore } from './storage';

// The live settings every scene and system reads, and the two lines that tie them to disk.
//
// A module singleton for the same reason `eventBus` is one: `AudioSystem` inside a run and
// `OptionsScene` outside it must see the same record, and neither may hold a reference to
// the other. Everything about *what* a setting is lives in `core/settings.ts`, where it is
// portable and tested; this file only decides where the values come from and go.

export const settings = new SettingsStore();

/** Called once, at boot. A missing or corrupt save leaves the defaults in place. */
export function loadSettings(): void {
  settings.replace(saveStore.load().settings);
}

/** Called whenever the player changes something. Failure to write is never worth a crash. */
export function persistSettings(): void {
  saveStore.saveSettings(settings.get());
}
