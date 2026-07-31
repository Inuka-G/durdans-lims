## What changed

<!-- One or two sentences. What does this do, and why now? -->

## Affected areas

<!-- Tick what this touches — it tells the reviewer which CI runs apply. -->

- [ ] `apps/frontend`
- [ ] `apps/lims-core-service`
- [ ] `apps/lims-instrument-simulator`
- [ ] `infra`
- [ ] `load-testing`
- [ ] `docs`

## How it was verified

<!-- Commands run, screens checked, tests added. "CI is green" alone is not
     verification — CI does not cover much of this system yet. -->

## Checklist

- [ ] No credential, token, or realm export is in the diff
- [ ] No `.vscode/` or other editor config is in the diff
- [ ] Schema changes go through a Liquibase changeset, not a manual migration
- [ ] Anything user-facing in the clinical pipeline was exercised by hand
