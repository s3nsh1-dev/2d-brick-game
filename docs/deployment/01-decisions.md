# Three decisions

Three questions were asked together: does this project need `vercel.json`, does it need Docker,
and is CI/CD worth having. The answers are **yes (minimally)**, **no**, and **yes** — and the
reasoning matters more than the answers, because two of the three are things almost every project
adds by reflex.

The standard applied is the one `CLAUDE.md` has enforced since Stage 1:

> If it is not in the current scope, it does not appear in the diff. Speculative generality is
> the thing this exercise is designed to teach me to avoid.

A config file that restates a default is speculative in exactly that way. So each of these had to
earn its place by doing something that would otherwise not happen.

---

## 1. `vercel.json` — yes, but not for the usual reason

**The question came from a three.js project that needed one.** That is worth unpicking, because
it is the single most common reason a Vite project carries a `vercel.json`, and it does not
apply here:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

That rewrite exists for **client-side routing**. A single-page app with a router owns URLs like
`/about` that have no matching file on disk; without the rewrite, a hard refresh on `/about`
returns a 404 from the static host, because the host looks for `dist/about/index.html` and there
isn't one. The rewrite says *"whatever the path, serve the app and let JavaScript sort it out."*

**`arena` has one URL.** No router, no deep links, no paths beyond `/`. Adding that rewrite would
configure around a problem the game cannot have — and worse, it would mask a genuine 404 on a
missing asset by serving HTML in its place, which turns a clear failure into a confusing one.

### So what does earn its place

Two things the platform defaults do not give:

**Build settings, in the repo.** Vercel auto-detects Vite correctly, and those settings then live
in a dashboard. That is fine until someone re-imports the project, or clicks something, or you
want to know six months later what the build actually was. Committing them makes the repository
the source of truth, which is the same argument as `engines.node` and the same instinct as
invariant 5 — the number lives in one place and that place is the code.

**Two response headers.** `X-Content-Type-Options: nosniff` and a `Referrer-Policy`. Both are
free, neither can break a game with no forms and no auth.

### What was deliberately left out

- **The SPA rewrite.** Above.
- **`X-Frame-Options` / `frame-ancestors`.** The reflex is to deny framing. This is a browser
  game, and being embeddable in an itch.io page or a blog post is a *feature*. Denying it would
  trade something real for a threat model that does not exist here — there is nothing to
  clickjack.
- **Cache-Control headers.** Vite content-hashes every asset and Vercel already serves hashed
  static files as immutable while keeping `index.html` revalidating. Restating that would add a
  place for the two to disagree.
- **`regions`, `functions`, `crons`, `redirects`.** No server, no routes, no history to preserve.

**Honest summary:** the file is four settings and two headers. If it were only the four settings,
it would be defensible to skip entirely and let auto-detection do its job — that is a legitimate
position and it is not wrong. It exists because config-as-code costs fifteen lines and a dashboard
click costs an afternoon of confusion at the worst possible time.

---

## 2. Docker — no

**The artifact is a directory of static files.** `npm run build` produces `dist/`: one HTML file,
one JavaScript bundle, one JSON file. There is no server process, no runtime, no port to expose
and no state to persist.

A container is a way to ship *an environment*. This project's deployable does not have one —
whatever runs it, the browser is the runtime. So a `Dockerfile` here would do one of two things:

- **Wrap nginx around `dist/`.** That produces an image whose entire job is `COPY dist /usr/share/nginx/html`.
  Vercel does not consume it. It would be a second, untested way to run the game, existing beside
  the one that is actually used.
- **Pin the build toolchain.** Genuinely useful in some projects — but CI already pins Node via
  `setup-node` and dependencies via `npm ci` and `package-lock.json`, which is the reproducibility
  that actually matters, at none of the cost.

Adding it would mean a file that nobody runs, that no check exercises, and that silently rots
until someone trusts it. That is precisely the failure mode this repository is built to avoid, and
it is the same reasoning that declined a texture atlas in Stage 3 Pass D: *the thing everyone
assumes you need was measured against the actual problem and did not earn its place.*

### What would change this answer

Say so and it takes ten minutes — the decision is contextual, not principled:

- **Self-hosting.** Deploying to your own VPS, Fly.io, Cloud Run or a homelab instead of a static
  host. Then a container is the deployable and nginx is the right base.
- **A backend appears.** A leaderboard, an account system, anything with a process. Then there is
  an environment to ship.
- **Portfolio intent.** If the point is to *demonstrate* containerisation, that is a real reason,
  and it should be stated as one rather than dressed up as a technical requirement.

---

## 3. CI/CD — yes, and it closed a real gap

This is the one that was actually missing, and it is worth being blunt about why.

`AGENTS.md` has required this since Stage 1:

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

Every stage brief repeats it. `CLAUDE.md` calls it the definition of done. And for three stages it
has been enforced by **a human remembering to type it.** That worked because the project had one
careful contributor. It is not a process, it is a habit, and habits do not survive a hurried
Friday.

`.github/workflows/ci.yml` runs those four commands, in that order, on every push and every pull
request. It adds no new rules — it enforces the ones the project already wrote down. That is the
cheapest possible kind of automation: it encodes a decision that was already made.

### The CD half already existed

Vercel's Git integration deploys on push: production from the default branch, a preview URL for
every other branch. That is continuous deployment, it was there the moment the project was
imported, and it needs no pipeline of its own.

So the pipeline is deliberately **CI only**. [Page 3](03-ci-cd.md) covers the consequence — the
two systems do not gate each other — and what to do about it.

---

## The pattern in all three

The same test decided each one: **does this cause something to happen that would not otherwise
happen?**

- The `vercel.json` build settings move a fact from a dashboard into the repository — yes, barely.
- The SPA rewrite would configure around a problem that cannot occur — no.
- A Dockerfile would produce an image nothing consumes — no.
- CI runs four commands nobody is guaranteed to run — yes, clearly.

Two of the three things a reflex would have added are not here, and the reasoning is written down
so the next person does not have to re-derive it — or, worse, add them anyway because the absence
looked like an oversight.
