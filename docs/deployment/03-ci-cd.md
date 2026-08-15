# The pipeline

`.github/workflows/ci.yml` runs the project's own definition of done on every push and every pull
request. It does not deploy. This page explains both halves of that, including what the split
costs.

---

## What it runs

The four commands `AGENTS.md` has required since Stage 1, in the same order:

```
npm ci  →  typecheck  →  lint  →  test  →  build
```

No new rules. The workflow encodes a decision the project made in Stage 1 and has been enforcing
by memory ever since.

### Four steps, not one chained command

```yaml
- name: typecheck
  run: npm run typecheck
- name: lint
  run: npm run lint
```

rather than `run: npm run typecheck && npm run lint && ...`. Chained, a failure gives you one red
step and a log to read. Separate, GitHub's UI tells you *which* check failed before you open
anything. The four are independent, so there is nothing to gain from chaining them.

### `npm ci`, not `npm install`

`ci` installs exactly what `package-lock.json` pins, and fails if the lockfile and
`package.json` disagree. `install` will happily resolve something newer and rewrite the lockfile.

**A check that can change the thing it is checking is not a check.** The same reasoning puts
`npm ci` in `vercel.json`: the build that ships should use the dependency tree that was tested.

### Node version

`setup-node` pins `22.x` explicitly, while `package.json` declares the wider range Vite 8 accepts
(`^20.19.0 || >=22.12.0`). That is not a contradiction — the range says *what the project
supports*, the pin says *what this check ran on*. A check that runs on "whatever the runner ships
today" produces results that quietly change meaning over time.

### Concurrency and permissions

```yaml
concurrency:
  group: checks-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
```

A second push to a branch cancels the first run — nothing here has side effects, so the only
thing cancelling costs is minutes it saves. `contents: read` is the minimum the job needs; the
default token is broader than that, and a workflow that only reads code should only be able to
read code.

---

## Why it does not deploy

**Vercel already does continuous deployment.** Its Git integration builds production from the
default branch and gives every other branch a preview URL. That existed the moment the project was
imported and it needs no pipeline.

A deploy step in Actions would mean two systems able to publish the same site, which is worse than
it sounds:

- Two build environments that can drift, so "works on the deploy that Actions made" becomes a
  sentence someone has to say.
- A Vercel token in GitHub secrets — a credential that exists only to duplicate a capability the
  platform already grants for free.
- Two places to look when a deploy goes wrong.

So the split is deliberate: **Actions decides whether the commit is good. Vercel decides where it
goes.**

---

## The gap this leaves, stated plainly

The two systems do not talk to each other, which means:

> **Vercel deploys whether or not the checks passed.** Push a commit that fails `typecheck` to
> `main` and it will be built and published anyway, because Vercel's build only runs `npm run
> build` — and `vite build` does not typecheck.

That is a real hole and it should not be discovered later. Three ways to close it, in increasing
cost:

| Option | What it does | Cost |
|---|---|---|
| **Branch protection** (recommended) | Require the `checks` job to pass before anything can merge into `main`. Broken code can then only reach production by a direct push, which protection also blocks | Two minutes in GitHub settings. Free on public repos |
| **Vercel's Ignored Build Step** | A command Vercel runs to decide whether to build at all; it can query the commit's check status and skip | Some scripting, and a build that "succeeds" by not happening reads oddly in the dashboard |
| **Deploy from Actions** | Turn off Vercel's Git integration, run `vercel deploy --prebuilt` after the checks pass | Full control, and every cost in the section above |

**Branch protection is the right answer for this project.** It closes the hole where it actually
occurs — the merge — rather than adding machinery downstream of it. Enable it under
**Settings → Branches → Add rule** on `main`, requiring the `checks` status.

Until that is enabled, the honest description of this setup is *"CI reports, it does not gate."*

---

## What is deliberately not in the pipeline

- **No deploy step.** Above.
- **No test matrix.** One Node version, one OS. The game runs in a browser; testing the build on
  three Node versions would exercise the toolchain, not the product.
- **No coverage gate.** `vitest.config.ts` is `environment: 'node'` and covers `core/` and
  `components/` by design — scenes and systems are verified by playing. A coverage percentage
  would measure the deliberate absence of scene tests and call it a regression.
- **No caching beyond `setup-node`'s npm cache.** The whole run is well under a minute.
- **No release automation, changelog generation or version bumping.** The project is finished and
  `private: true`. Nothing is published to a registry.

Each of those is a thing pipelines usually accumulate. None of them causes something to happen
that would not otherwise happen — which is the same test that decided the other two questions on
[page 1](01-decisions.md).
