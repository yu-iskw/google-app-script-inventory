# `@google-app-script-inventory/common`

Shared **types**, **constants**, and **CLI option shapes** for the Google Apps Script inventory monorepo.

## Contents

- OAuth scope lists used by Google APIs (`GOOGLE_SCOPES` and scoped subsets)
- Shared CLI types (`GlobalCliOptions`, scan/export/AI options)
- Catalog domain types (for example script metadata, deployments, AI status)

## Consumers

Used by [`@google-app-script-inventory/catalog`](../catalog/) and [`@google-app-script-inventory/catalog-ai`](../catalog-ai/).

## Build

```bash
pnpm --filter @google-app-script-inventory/common build
```

For repository-wide setup and the main CLI, see the [root README](../../README.md).
