# `@google-app-script-inventory/catalog`

Command-line **catalog** for standalone Google Apps Script governance: discovery, SQLite storage, exports, and optional AI enrichment.

## CLI

The package exposes the `catalog` binary ([`package.json`](./package.json) `bin`). Commands include:

- **`scan full`** — Full standalone Apps Script discovery (optional `--ai` for inline enrichment)
- **`export json` / `export csv`** — Export the latest snapshot
- **`db migrate` / `db doctor`** — Create or validate the SQLite schema
- **`ai enrich-pending` / `ai doctor`** — Optional AI enrichment and configuration checks

AI features load [`@google-app-script-inventory/catalog-ai`](../catalog-ai/) when installed; if the optional package is missing or misconfigured, AI operations degrade gracefully (for example enrichment disabled or provider unavailable).

## Build

```bash
pnpm --filter @google-app-script-inventory/catalog build
```

## Documentation

Workspace authentication, example invocations, and AI environment variables are documented in the [root README](../../README.md). Developer workflow (filters, tests, conventions) is in [CONTRIBUTING.md](../../CONTRIBUTING.md).
