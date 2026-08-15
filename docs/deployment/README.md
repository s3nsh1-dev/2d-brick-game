# Deployment

**What this folder is:** how `arena` gets from a commit to a URL, and why it is built the way it
is. Operational and current — unlike `docs/version1..3/`, which are history and are never edited.

| Page | What it covers |
|---|---|
| [1 — Three decisions](01-decisions.md) | `vercel.json`, Docker and CI/CD: what was added, what was refused, and what would change each answer |
| [2 — Vercel](02-vercel.md) | The deployment logic: what is actually shipped, how the build runs, the config file line by line, branches, rollback |
| [3 — The pipeline](03-ci-cd.md) | What CI checks, why it does **not** deploy, and the one gap that leaves |

---

## The shape of it

```
push to a branch ──▶ GitHub Actions          ──▶ four checks, no side effects
                 └─▶ Vercel Git integration  ──▶ build ──▶ preview URL

push to main     ──▶ GitHub Actions          ──▶ four checks
                 └─▶ Vercel Git integration  ──▶ build ──▶ production URL
```

Two systems watch the same repository and do different jobs. **GitHub Actions decides whether the
commit is good. Vercel decides where it goes.** They do not talk to each other, and
[page 3](03-ci-cd.md) explains why that is a deliberate choice rather than an oversight, along
with what it costs.

## The answers, in one line each

| Question | Answer | Why |
|---|---|---|
| Does it need `vercel.json`? | **Yes, minimal** | Not for the reason most projects need one. The build settings belong in the repo; the SPA rewrite does not apply here |
| Does it need Docker? | **No** | The artifact is a folder of static files. A container would have nothing to contain |
| Is CI/CD worth having? | **Yes, and it was the real gap** | The project has had a four-command definition of done since Stage 1 and it was enforced by a human remembering |

Each of those is argued properly on [page 1](01-decisions.md), including the case *against* the
two that were built.

## Files this adds to the repo

| Path | Job |
|---|---|
| `vercel.json` | Build settings and two response headers. Nothing else |
| `.github/workflows/ci.yml` | The four checks, on every push and pull request |
| `package.json` → `engines.node` | The Node range Vite 8 actually requires |

## Prerequisites

The one that is not obvious, and the one that will bite: **the code has to be on GitHub first.**
As of the Stage 3 tag, `origin/main` still pointed at the Stage 1 commit — every Stage 2 and
Stage 3 commit was local only. Vercel deploys what your default branch contains, faithfully and
without complaint. [Page 2](02-vercel.md) opens with this.
