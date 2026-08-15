import { SaveStore, type StorageAdapter } from '../core/SaveStore';

// The one place the game names a browser API that is not Phaser's.
//
// `core/SaveStore` may not name `window` (invariant 15) and takes its storage as an adapter
// for exactly that reason; this is where the adapter is made. It was a private function in
// `GameOverScene` through Stage 2, when one scene needed it. Three do now, and a helper
// imported from another scene is a coupling with no name.
//
// A module singleton, like `eventBus`: one store, created once, shared by every scene that
// reads or writes a record. Constructing it at import time is safe because every path
// through the adapter is wrapped — a browser with storage disabled throws on the property
// access itself, before `SaveStore` is ever reached.

function browserStorage(): StorageAdapter | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const saveStore = new SaveStore(browserStorage());
