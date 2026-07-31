# Branching

Replaces the generated `branch_structure.json` files that used to sit in two of
the predecessor repositories and drift out of date.

## Branches

| Branch | Purpose | Protected |
| --- | --- | --- |
| `main` | Release. Only ever updated by a merge from `develop`. | yes |
| `develop` | Integration. Feature branches merge here. | yes |
| `feature/<short-name>` | One change. Deleted after merge. | no |
| `fix/<short-name>` | Bug fix. Deleted after merge. | no |

There is no long-lived `enterprise-hardening` branch. That was a review branch
in the predecessor repositories and has been folded into the consolidated
history; do not recreate it.

## Flow

```
feature/patient-search ──PR──▶ develop ──PR──▶ main
```

- Branch from `develop`, never from `main`.
- One concern per pull request. The commit that started the July 2026 security
  incident bundled editor config, a font pack, a changelog and a generated JSON
  file under a message about navigation links — a diff nobody could review.
- Rebase onto `develop` before requesting review; merge commits into `develop`
  are fine, a tangled history is not.

## Commit messages

Conventional-commit style, and the subject must describe the diff:

```
feat(orders): add fasting-status flag to order intake
fix(dispatch): retry SMS send on transient gateway failure
docs(runbook): correct restore command for the LIMS database
chore(deps): bump spring-boot to 3.5.4
```

Never include AI tool attribution. The `commit-msg` hook strips it and CI
rejects it — see [../SECURITY.md](../SECURITY.md).

## Before merging

CI is path-filtered, so a green run means only the touched areas were checked.
The security workflow runs on everything. Neither is a substitute for opening
the app and using the screens you changed.
