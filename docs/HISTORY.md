# Repository history

This repository was created on **2026-07-31** by consolidating five separate
repositories into one. It begins at a single commit; the per-file history of
everything here lives in the archived originals.

## Why the history was not imported

The five source repositories carried, in their commit history:

- eight real credentials across ~216 commits (see
  [SECURITY-INCIDENT-2026-07.md](SECURITY-INCIDENT-2026-07.md));
- an obfuscated JavaScript payload and the auto-running editor task that
  launched it.

Importing that history would have carried both into the first commit of a new
repository. A history rewrite could have removed them, but "we believe we caught
every one" across five merged histories is not a claim that can be verified.
Starting clean can be verified in one command:

```bash
git rev-list --count HEAD          # 1
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect --source=/repo
```

The archived repositories remain the historical record. They are read-only.

## Archived sources

| Repository | Branch | Final SHA | Commits | Destination in this repo |
| --- | --- | --- | --- | --- |
| `durdans-hospital-lims/frontend` | `develop` | `9c1c779` | 74 | `apps/frontend/` |
| `durdans-hospital-lims/lims-core-service` | `develop` | `69bf29f` | 114 | `apps/lims-core-service/` |
| `durdans-hospital-lims/lims-infrastructure` | `main` | `c49e768` | 2 | `infra/` |
| `durdans-hospital-lims/lims-instrument-simulator` | `main` | `1db2739` | 1 | `apps/lims-instrument-simulator/` |
| `durdans-hospital-lims/load-testing` | `main` | `9fed96a` | 1 | `load-testing/` |

To trace a line of code back past the consolidation commit, open the
corresponding archived repository at the SHA above and use `git log --follow` on
the path with the `apps/` or `infra/` prefix removed.

## What was deliberately not migrated

| Item | Reason |
| --- | --- |
| `.vscode/` (4 repositories) | auto-executing task; see the incident record |
| `public/fonts/` in the backend | a font bundle in a Java service, one file of which was the payload |
| `scripts/purge-secrets.sh` | contained the plaintext credentials it claimed to purge, and was never run |
| `tools/scrub-history.sh` | same problem |
| `branch_structure.json` | stale generated artifact, superseded by `BRANCHING.md` |
| Build output, `node_modules`, `.gradle` | export used `git archive`, so only tracked files came across |
