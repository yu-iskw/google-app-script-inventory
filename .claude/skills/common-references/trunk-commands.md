# Trunk CLI Reference

This document provides a summary of common Trunk commands used for linting and formatting.

## Trunk in this repository (pnpm)

After `pnpm install`, the Trunk **launcher** is provided by the devDependency `@trunkio/launcher` (binary: `node_modules/.bin/trunk`). The actual Trunk CLI version used at runtime is pinned in `.trunk/trunk.yaml` under `cli.version`, not only by the launcher package version.

**Prefer these for everyday work:**

- `pnpm lint` — runs `trunk check` on changed files
- `pnpm format` — runs `trunk fmt` on changed files
- `pnpm lint:security` — `trunk check` scoped to security tools

**Optional:** prefetch hermetic linters and formatters (useful before offline work or in images):

- `pnpm exec trunk install` or `pnpm trunk install`

For other install options (including global CLI), see the [Trunk installation guide](https://docs.trunk.io/references/cli/getting-started/install). On macOS, `brew install trunk-io` is optional if you want `trunk` on your PATH outside npm scripts.

## Core Commands

- `trunk check`: Runs all enabled linters on the changed files.
- `trunk fmt`: Runs all enabled formatters on the changed files.
- `trunk check --all`: Runs linters on all files in the repository.
- `trunk fmt --all`: Runs formatters on all files in the repository.

## Filtering and Scoping

- `trunk check --scope <name>`: Runs only the linters in the specified scope (e.g., `security`).
- `trunk check --filter <linter>`: Runs only the specified linter.

## Troubleshooting

If `trunk check` fails due to environment issues, ensure that the required runtimes (e.g., Node.js, Python) are installed and accessible as defined in `.trunk/trunk.yaml`.
