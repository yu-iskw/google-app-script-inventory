---
name: google-apps-script-org-inventory
description: >
  Run the Google Apps Script governance catalog CLI against a Workspace domain—ask for
  required scan parameters (impersonated service account, admin subject, paths, AI)
  before executing commands; then build, migrate SQLite, scan via domain-wide
  delegation, optional Vertex enrichment, and export JSON/CSV. Use when inventorying
  Apps Script, setting up catalog scan, or catalog ai doctor.
---

# Google Apps Script organizational inventory

## Purpose

Use the [`catalog`](../../../packages/catalog/) CLI in this repository to discover and persist **standalone** Google Apps Script projects for governance exports. The v1 catalog is authoritative for scripts visible via delegated Drive discovery; **container-bound scripts are an unsupported blind spot** (see [README.md](../../../README.md)).

If the dev environment is broken, run the `setup-dev-env` skill first. Prerequisites: Node.js and pnpm versions in [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Clarify parameters before running commands

Do **not** invent or silently substitute values such as `admin@example.com` or `dwd-catalog@example-project.iam.gserviceaccount.com`. Ask the user for anything missing, then plug their answers into the CLI or env vars.

Ask at least:

1. **Impersonated service account** — Full email of the GCP service account to pass to `--impersonate-service-account` (or `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`). This is the delegated principal; confirm it matches the account configured for domain-wide delegation in Admin.
2. **Admin subject** — Workspace user email for `--admin-subject` (or `GOOGLE_ADMIN_SUBJECT`): the mailbox used as the delegated admin subject for the scan.
3. **Catalog database path** — Accept default `./data/catalog.sqlite` / `CATALOG_DB_PATH` unless they need a different `--db-path`.
4. **Exports** — Paths for `export json` and `export csv` (`--out`), or confirm defaults such as `./artifacts/…`.
5. **AI during or after scan** — Whether to use `--ai` on `scan full`, run `ai enrich-pending` later, or skip AI. If they want Vertex, confirm `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `VERTEX_MODEL` (see [README.md](../../../README.md#cli)) or environment-specific equivalents.

If the user already provided some of these in their message, only ask for what is still unknown.

## Build and migrate the database

From the repository root:

```bash
pnpm --filter @google-app-script-inventory/catalog build
pnpm --filter @google-app-script-inventory/catalog exec catalog db migrate
```

Optional: validate the database.

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog db doctor
```

Override the SQLite path if needed: `--db-path <path>` or `CATALOG_DB_PATH` (see [CONTRIBUTING.md](../../../CONTRIBUTING.md)).

## Workspace authentication

Inventory uses **Application Default Credentials (ADC)** plus **impersonation of a single service account** authorized for **domain-wide delegation** in Google Admin. You need:

- ADC available (`gcloud auth application-default login` for local dev)
- `roles/iam.serviceAccountTokenCreator` on the target service account for the ADC principal
- Domain-wide delegation configured for that service account’s OAuth client ID, with required scopes allowlisted
- IAM Credentials API enabled on the GCP project

Step-by-step checklist: [references/workspace-catalog-runbook.md](./references/workspace-catalog-runbook.md). Full narrative: [README.md — Workspace Authentication](../../../README.md#workspace-authentication).

## Scan

Set `GOOGLE_ADMIN_SUBJECT` and `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT`, or pass flags:

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog scan full \
  --admin-subject admin@example.com \
  --impersonate-service-account dwd-catalog@example-project.iam.gserviceaccount.com
```

Enable inline AI during the scan (optional):

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog scan full \
  --admin-subject admin@example.com \
  --impersonate-service-account dwd-catalog@example-project.iam.gserviceaccount.com \
  --ai
```

Equivalent using `node` on built output (see [README.md](../../../README.md#cli)):

```bash
node packages/catalog/dist/cli.js scan full \
  --admin-subject admin@example.com \
  --impersonate-service-account dwd-catalog@example-project.iam.gserviceaccount.com
```

## Optional Vertex AI enrichment

Configure Vertex per [README.md](../../../README.md#cli) (e.g. `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `VERTEX_MODEL`). Validate configuration:

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog ai doctor
```

Batch enrichment after scan (optional):

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog ai enrich-pending
```

Provider selection: `AI_PROVIDER` or `--provider` on `ai` subcommands (see [CONTRIBUTING.md](../../../CONTRIBUTING.md)).

## Export

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog export json --out ./artifacts/scripts-latest.json
pnpm --filter @google-app-script-inventory/catalog exec catalog export csv --out ./artifacts/scripts-latest.csv
```

## Troubleshooting

- Database: `catalog db doctor`
- AI: `catalog ai doctor`
- Increase verbosity: `LOG_LEVEL=debug` (and `--log-level debug` on the CLI)

## Success criteria

- `catalog db migrate` (or `db doctor`) succeeds
- `catalog scan full` completes without auth errors
- `export json` / `export csv` write files at the requested `--out` paths

## Environment variables

See the table in [CONTRIBUTING.md — Working on the CLI](../../../CONTRIBUTING.md#working-on-the-cli). Do not commit secrets, service account keys, production databases, or sensitive exports.
