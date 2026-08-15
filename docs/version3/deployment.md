# Deployment runbook

**The game is not deployed.** That is the owner's decision, recorded in
`docs/STAGE_3_instructions.md` §6 and in [`../STATUS.md`](../STATUS.md) §2 issue 3 — not a gap
in readiness. Everything below is what a deploy needs, written while it was fresh.

---

## What is being deployed

Static files. There is no backend, no environment variable, no server-side rendering, no
database, and no runtime asset to fetch beyond one JSON file.

```bash
npm ci
npm run build     # emits dist/
```

`dist/` after a build:

```
dist/index.html                  ~5 kB      the page, the error boundary, the inline favicon
dist/assets/index-<hash>.js      ~1.5 MB    everything, almost all of it Phaser (394 kB gzip)
dist/assets/waves-<hash>.json    ~5 kB      wave content; the other two JSON files inline
dist/assets/.gitkeep                        an empty placeholder from public/assets/, harmless
```

Serve `dist/` as a static directory. That is the whole deployment.

**Node 20.19+ or 22.12+** is required to *build* (a Vite 8 constraint). Nothing is required to
*run* it but a browser with WebGL.

---

## Before you deploy

```bash
npm run typecheck && npm run lint && npm run test && npm run build
npm run preview     # then play it: menu → run → level-up → pause → options → death → restart
```

The production build is the one that matters. Two things only show up there: the console must
be empty apart from Phaser's own version banner, and the error boundary in `index.html` must
*not* be showing.

---

## Per host

All four hosts the brief named work. They differ in exactly one way, and it is worth knowing
which before you pick.

| Host | Build command | Output dir | Notes |
|---|---|---|---|
| **Vercel** | `npm run build` | `dist` | Framework preset: Vite. Zero config needed. `vercel --prod` from the repo root, or connect the GitHub remote for push-to-deploy |
| **Netlify** | `npm run build` | `dist` | Same. `netlify deploy --prod --dir=dist`, or a `netlify.toml` with those two values |
| **GitHub Pages** | `npm run build` | `dist` | **Needs a config change — see below** |
| **itch.io** | `npm run build` | `dist` | Zip `dist/` and upload as an HTML game. Set the viewport to 1280×720 and enable fullscreen; `Scale.FIT` handles the rest |

### The one trap: GitHub Pages serves from a subpath

Vite's default `base` is `/`, so `dist/index.html` references `/assets/index-<hash>.js`
absolutely. On `user.github.io/repo-name/` that resolves to `user.github.io/assets/…`, which
404s, and the player gets the error boundary's 20-second timeout message.

The fix is one line in `vite.config.ts`:

```ts
base: '/2d-brick-game/',   // the repo name, with both slashes
```

**Do not make this change pre-emptively.** It breaks Vercel, Netlify and itch.io, all of which
serve from the root. Make it only if GitHub Pages is the chosen target, and say so in the
commit message.

A user or organisation page (`user.github.io`, no repo segment) serves from the root and needs
no change.

---

## After you deploy

1. **Open the URL in a fresh profile or private window.** A cached `localStorage` save is the
   difference between "the migration works" and "the migration was never exercised".
2. **Check the console is empty** except Phaser's banner.
3. **Confirm the loading overlay disappears.** If `ARENA / loading…` is still on screen after a
   few seconds, the bundle did not execute — on a static host that is almost always a wrong
   `base` (see above) or a 404 on the JS file.
4. **Play one run to a death and restart once.** Restart safety is verified by restarting
   *twice*, and the second restart is the one that has ever caught anything.
5. **Change a volume, reload, confirm it stuck.** This is the cheapest end-to-end proof that
   `localStorage` is reachable on the deployed origin.
6. **Resize the window small.** It should letterbox, not crop or overflow.
7. **Paste the URL into a chat client** and confirm the Open Graph card renders — that is the
   only thing the OG tags are for and the only way to test them.

Then put the URL in `README.md` and remove issue 3 from `docs/STATUS.md` §2.

---

## Rollback

There is no state to migrate and no backend to coordinate with, so rollback is redeploying the
previous build. On Vercel and Netlify that is promoting the previous deployment in their UI —
instant, and it does not require the repo. On GitHub Pages it is reverting the commit that
published.

**The one thing rollback does not undo:** a save written by a newer version. `SaveStore` is
versioned for this — an older build reading a newer record fails `safeParse`, discards it, and
boots with defaults rather than crashing. The player loses their high score, not their game.
If that ever becomes unacceptable, the fix is a forward-compatible read, not a rollback policy.

---

## What would need thought if this ever grows

Stated so nobody rediscovers it, and *not* as a plan:

- **Caching.** The JS bundle is content-hashed and can be cached forever; `index.html` must not
  be. Every host in the table above does this correctly by default.
- **Analytics.** There are none, and adding any would be the first network request the game
  makes and the first privacy consideration in the project.
- **A custom domain** changes nothing technically; the OG tags carry no absolute URL.
