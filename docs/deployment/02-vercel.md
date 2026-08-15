# Vercel

The deployment logic: what is shipped, how it is built, and what each setting is for.

---

## Before anything else: push the code

**Vercel deploys what your default branch contains.** As of the `stage-3` tag, `origin/main` and
`origin/feature/stage2` both still pointed at `05b3234` — the Stage 1 commit. Every Stage 2 and
Stage 3 commit existed only on one machine.

Import the repository in that state and Vercel will build and publish a year-old prototype,
successfully, with a green build log and no warning of any kind. It is doing exactly what it was
asked.

```bash
git checkout main
git merge feature/stage2
git push origin main
git push origin --tags
```

If you would rather leave `main` alone, push the feature branch and set **Settings → Git →
Production Branch** to it. That works, but the repository's default branch is what a visitor sees
first, and leaving a prototype there is its own kind of bug.

---

## What actually gets deployed

```
dist/index.html                  ~6 kB    the page, the error boundary, the inline SVG favicon
dist/assets/index-<hash>.js     ~1.5 MB   everything, almost all of it Phaser (394 kB gzip)
dist/assets/waves-<hash>.json   ~5 kB     wave content; the other two JSON files inline
```

That is the whole deployable. No server, no database, no environment variable, no runtime asset
beyond one JSON file — every frame of art is baked from a `Graphics` object at boot and every
sound is synthesised, so the game makes **zero asset requests**. The favicon is an inline SVG data
URI for the same reason.

The practical consequence: nothing about this deploy can fail at runtime in a way that hosting
could fix. If the page loads, the game runs.

---

## `vercel.json`, line by line

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "headers": [ ... ]
}
```

| Key | Why |
|---|---|
| `framework` | Vercel would detect this. Stating it means a re-import cannot detect something else |
| `buildCommand` | The project's own script, so the build is identical to a local one |
| `outputDirectory` | Vite's default, and the single most common way a static deploy 404s |
| `installCommand` | **`npm ci`, not `npm install`.** `ci` installs exactly what `package-lock.json` pins and fails if the two disagree. A deploy that can quietly resolve a different dependency tree than the one you tested is not a deploy of what you tested |
| `headers` | `nosniff` and a `Referrer-Policy`. Free, and neither can break a game with no forms |

[Page 1](01-decisions.md) covers what is deliberately *not* in this file — in particular the SPA
rewrite that most Vite projects carry, and why adding it here would turn a clear 404 into a
confusing one.

### Do not add a `base` to `vite.config.ts`

Vercel serves from the domain root, so Vite's default `base: '/'` is correct. The subpath change
described in `docs/version3/deployment.md` is a **GitHub Pages** fix and would break this deploy
by pointing every asset at a directory that does not exist.

---

## Node version

`package.json` declares the range Vite 8 actually requires:

```json
"engines": { "node": "^20.19.0 || >=22.12.0" }
```

A range rather than a pin, and that is deliberate. Pinning `22.x` would make `npm install` print
an `EBADENGINE` warning on a machine running Node 24 — this one does — which trains you to ignore
a class of warning that sometimes matters. The range is the honest constraint: it satisfies
Vercel, it satisfies CI, and it stays quiet locally.

CI pins a specific version separately, in `setup-node`, because a check should run on one known
version rather than whatever the runner happens to ship.

---

## Branches and environments

| Push to | Result |
|---|---|
| default branch (`main`) | Production deployment, promoted to the project's main URL |
| any other branch | Preview deployment on its own URL, unaffected by production |
| a pull request | Same preview, with the URL commented on the PR |

Preview deployments are the most useful thing on the free tier: you can send someone a playable
build of a branch without touching the live one, and each has a permanent URL tied to its commit.

---

## After a deploy

Do this in a **private window**. A `localStorage` save carried over from `localhost` is the
difference between testing the save migration and never exercising it.

1. The `ARENA / loading…` overlay disappears, and the arena is centred and fills the window height.
   If the overlay is still there after a few seconds, the bundle 404'd or never executed — check
   the Network tab, and check `outputDirectory`.
2. The console is empty apart from Phaser's version banner.
3. Play one run to a death, then restart **twice**. The second restart is the one that has ever
   caught anything (invariant 9).
4. Change a volume in Options, reload, confirm it stuck — the cheapest end-to-end proof that
   `localStorage` works on the deployed origin.
5. Resize the window small; it should letterbox, not crop.
6. Paste the URL into a chat client and confirm the Open Graph card renders. That is the only way
   to test those tags.

Then record the URL in `README.md` and delete issue 3 from `docs/STATUS.md` §2 — it exists solely
to record that the game had not been deployed.

---

## Rollback

There is no state to migrate and no backend to coordinate with, so rollback is redeploying a
previous build.

**Vercel's instant rollback is a Pro feature.** On the free Hobby plan: **Deployments** → pick the
last good one → **Redeploy**. Same outcome, one build's worth of latency.

The one thing a rollback does not undo is a save written by a newer build. `SaveStore` is
versioned for exactly this: an older build reading a newer record fails `safeParse`, discards it
and boots with defaults rather than crashing. The player loses a high score, not the game. If that
ever becomes unacceptable the fix is a forward-compatible read, not a rollback policy.

---

## Free tier, honestly

The Hobby plan is licensed for **non-commercial use** — a portfolio piece, a game you share, a
link on a CV. Anything with revenue attached needs Pro. Bandwidth and build-minute allowances
change often enough that quoting numbers here would make this page wrong within a year; check
[vercel.com/pricing](https://vercel.com/pricing) when it matters.

For a static page of this size, none of the limits are a realistic concern. The bundle is 394 kB
gzipped and served once per player, per cache lifetime.

---

## Other hosts

Netlify, GitHub Pages and itch.io all work, and `docs/version3/deployment.md` covers each with the
one real trap between them — GitHub Pages serves from a subpath and needs the `base` change that
would break the other three.
