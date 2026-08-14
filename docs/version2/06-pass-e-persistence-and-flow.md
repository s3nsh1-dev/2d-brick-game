# 6. Pass E — persistence, flow, and documentation

**Delivered:** `core/SaveStore.ts` with an injected storage adapter, `scenes/PauseScene.ts`,
the records shown on the game-over screen, invariants 11–15 in `AGENTS.md`, and the
documentation updates that close the stage.

**The bar:** clearing `localStorage` and reloading works; writing garbage into the save key and
reloading works; the ledger is fully ticked and the docs are true.

---

## `SaveStore`

Persistent records across runs: high score, best wave, total runs.

### The adapter is the whole design

```ts
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

public constructor(private readonly storage: StorageAdapter | undefined) {}
```

`SaveStore` lives in `core/`, and `core/` may not name `window` any more than it may name
Phaser. The ESLint rule scoped to that folder bans Phaser specifically, but **portability is
the actual requirement and the DOM breaks it just as thoroughly** — a `localStorage` reference
would make the file untestable in the Node environment the suite runs in.

So storage arrives as a constructor argument. The tests inject a `Map`-backed class, a class
that throws on write (a full quota), and a class that throws on read (storage disabled). No
DOM, no jsdom, no shim.

The injection point is `GameOverScene`, which names `window.localStorage` — a scene may touch
the DOM. Even there it is wrapped, because **a browser with storage disabled throws on the
property access itself**, not on the first call:

```ts
function browserStorage(): StorageAdapter | undefined {
  try { return window.localStorage; } catch { return undefined; }
}
```

`undefined` is a supported state: every read returns the empty save and every write is a no-op.
A record of past runs is never worth interrupting a game over.

### `safeParse`, and why this is the one place

Everywhere else in the codebase, content is parsed with `.parse()` so malformed data crashes
loudly at boot. `SaveStore` is the exception and uses `.safeParse()`, because **the input is not
ours**. `waves.json` is authored in this repo; the contents of a `localStorage` key are whatever
survived a browser, a previous version, another tab, or a user with devtools open.

The chain: read → `JSON.parse` in a `try` → `safeParse` against the current schema → on failure,
attempt migration → on failure, the empty save. Nothing in that path can throw.

### Versioning and migration

Invariant 15 requires a schema version, migration where possible and discard where not. That
means at least two versions must exist, or the migration mechanism is untested — and an
untested migration path is not a migration path.

So the current version is **2**, and a v1 shape (before `totalRuns` existed) is retained with a
comment stating plainly that it never shipped outside development. The alternative — ship v1
and write the migration later — guarantees that the first real shape change discards everyone's
records.

**A save from a *newer* version is discarded, not guessed at.** Guessing at a shape from the
future is how a migration corrupts data rather than rescuing it.

`recordRun` folds a finished run in and returns the updated record whether or not the write
landed, so the screen shows the run the player just had rather than the one last persisted.

---

## `PauseScene`

Escape freezes the run and layers a screen over it. The same shape as `UpgradeScene`: `pause()`
not `sleep()`, and the layered scene resumes the game itself.

Two details worth recording:

**The keyboard guard.** A paused scene still *receives* input events — pausing halts `update`,
not the input plugin. Without a guard, pressing Escape while the upgrade menu was open would
stack a second frozen layer over the first:

```ts
if (this.scene.isPaused() || this.scene.isActive(SceneKey.UPGRADE)) return;
```

**Teardown stops both layers.** `GameScene`'s shutdown handler stops `UpgradeScene` and
`PauseScene` unconditionally. A run can end while a layered scene is open, and a surviving layer
would sit on top of the next run.

---

## Documentation, and why it counts as work

The stage is not done when the code works. Three documents had to become true again:

**`AGENTS.md`** gained invariants 11–15 — exactly five, because Stage 3 numbers its own from 16
and depends on that count.

**`ARCHITECTURE.md`** was substantially rewritten: the stage line, the frame pipeline (which now
has a hit-stop branch above the player), the scene table (two new scenes and the `pause` vs
`sleep` rationale), the systems table (three new systems), the event catalogue (five events →
eleven), the content-vs-balance section (two files → three), and four new rows in "which file do
I touch".

**`docs/STATUS.md`** — the checkpoint document — had its snapshot table, feature list, verified
behaviours, known issues, staging diagram and upgrade catalogue updated.

**`docs/STAGE_2_INSTRUCTIONS.md`** had all 22 ledger rows ticked and two corrections recorded
against its own text.

The project's rule is that stale documentation is worse than none, because it will be trusted.
The corollary that Stage 2 took seriously: **a document that records a measurement should record
the measurement that was actually taken**, including when it contradicts what the document
previously claimed.

---

## Closing the Stage 3 readiness gate

The Stage 2 brief lists seven conditions that the next stage was assumed to depend on. All
seven were re-checked against the code as it actually stood, not as it was expected to stand:

| # | Gate | Result |
|---|---|---|
| 1 | `enemies.json`, `upgrades.json` + schemas are the only content source | ✅ |
| 2 | `core/` has zero Phaser and zero DOM | ✅ — the only mention of `window` is a comment explaining the adapter |
| 3 | Gameplay systems have no runtime Phaser imports | ✅ **with a correction** — see [difficulties](07-difficulties-and-fixes.md) |
| 4 | Presentation only subscribes | ✅ |
| 5 | Every `Math.random` is countable and inside a system | ✅ six: five in `SpawnSystem`, one in `ProgressionSystem` |
| 6 | No `Date.now`/`performance.now` in outcome paths | ✅ none anywhere — `SaveStore` chose not to stamp a timestamp at all |
| 7 | Fixed pool sizes, no allocation in an update path | ✅ `FloatingText` joined the pooled types |

Item 5 is worth a note: the count went from five to six exactly as the brief predicted it would,
and the seventh candidate — particle jitter — is Phaser's own, inside emitter configs, and is
documented as exempt at the call site so the seeding pass does not have to relitigate it.

---

**Next:** [Difficulties and fixes](07-difficulties-and-fixes.md)
