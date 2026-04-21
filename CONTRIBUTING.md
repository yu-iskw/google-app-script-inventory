# Contributing

This guide is for developers who change or extend this repository. End-to-end Google Workspace authentication, CLI examples, and operator-focused notes live in the [README](README.md).

## Requirements

- **Node.js** `>=24.13.0` (see [`.node-version`](.node-version) for the pinned version used in this repo)
- **pnpm** `>=10.28.1` (see [`package.json`](package.json) `engines`)

## Getting set up

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
```

Use `pnpm dev` for a watched build across packages (`pnpm build --watch`).

## Monorepo layout

This is a pnpm workspace ([`pnpm-workspace.yaml`](pnpm-workspace.yaml)). Internal packages reference each other with the `workspace:` protocol in `package.json`.

| Package                                   | Role                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `@google-app-script-inventory/common`     | Shared types, constants (for example OAuth scopes), and CLI option shapes        |
| `@google-app-script-inventory/catalog`    | Commander CLI (`catalog`), Google Workspace integration, SQLite catalog, exports |
| `@google-app-script-inventory/catalog-ai` | Optional Vertex AI enrichment provider (optional dependency of `catalog`)        |

Run a script in one package:

```bash
pnpm --filter @google-app-script-inventory/catalog build
pnpm --filter @google-app-script-inventory/common build
```

Recursively run a script in every package:

```bash
pnpm -r build
```

## Working on the CLI

Build the catalog package, then run migrations before scans:

```bash
pnpm --filter @google-app-script-inventory/catalog build
pnpm --filter @google-app-script-inventory/catalog exec catalog db migrate
```

Useful environment variables (defaults often exist in code or the shell):

| Variable                             | Purpose                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `CATALOG_DB_PATH`                    | SQLite database path (CLI: `--db-path`)                                                          |
| `LOG_LEVEL`                          | Log level (CLI: `--log-level`)                                                                   |
| `GOOGLE_ADMIN_SUBJECT`               | Delegated admin subject for `scan full` (CLI: `--admin-subject`)                                 |
| `GOOGLE_IMPERSONATE_SERVICE_ACCOUNT` | Service account to impersonate for domain-wide delegation (CLI: `--impersonate-service-account`) |
| `AI_PROVIDER`                        | AI provider id (see `catalog ai` subcommands)                                                    |

Optional Vertex enrichment (when `catalog-ai` is installed and configured) uses `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `VERTEX_MODEL`—see the [README](README.md) and [`packages/catalog-ai/README.md`](packages/catalog-ai/README.md).

Do not commit secrets, service account keys, or production database files.

## Code quality

- **TypeScript** throughout; follow existing naming and module layout in each package.
- **Linting and formatting** run through [Trunk](https://trunk.io/) (`pnpm lint`, `pnpm format`).
- **Tests** use [Vitest](https://vitest.dev/); place tests alongside sources as `*.test.ts`.

Before opening a pull request, run:

```bash
pnpm lint && pnpm test
```

## Git workflow

- Branch from `main` for feature work.
- Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, and so on), for example `feat(catalog): add export flag`.

## Architecture notes

- Record significant design decisions as Architecture Decision Records (ADRs) under `docs/adr` when you introduce durable architectural choices.
- If the project uses [Changie](https://changie.dev/) for release notes, add fragments as part of user-visible changes.
