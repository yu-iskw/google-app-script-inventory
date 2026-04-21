---
name: codeql-fix
description: Run CodeQL security/quality analysis and fix findings. Use when the user asks to run CodeQL, security scan, static analysis, or fix CodeQL findings.
compatibility: Requires CodeQL CLI on PATH (e.g. brew install codeql). Use a Node.js toolchain for JavaScript/TypeScript analysis or a Go toolchain when analyzing Go.
---

# CodeQL Fix

## Trigger scenarios

Activate this skill when the user says or implies:

- Run CodeQL, security scan, static analysis
- Fix CodeQL findings, address CodeQL alerts

## Preconditions

- [CodeQL CLI](https://github.com/github/codeql-cli-binaries/releases) on `PATH` (e.g. `brew install codeql`)
- **Language toolchain:** For **JavaScript/TypeScript**, use Node.js per [`.node-version`](../../../.node-version). For **Go**, use a Go toolchain matching the repo’s `go.mod` when one exists (this repository is TypeScript-first; use `--language=javascript` for CodeQL here).

## Run analysis (repository root)

All commands below assume `cd "$(git rev-parse --show-toplevel)"`.

### 1. Create the database (default: Go-only, minimal)

Prefer **no** `--codescanning-config` for Go-only runs: Go extraction does not apply `paths-ignore` (see [references/code-scanning-config.md](references/code-scanning-config.md)).

```bash
codeql database create ./codeql-db --language=go --source-root . --overwrite
```

Do not commit `codeql-db/` (large, machine-specific). It should remain in [`.gitignore`](../../../.gitignore).

### 2. Optional: render a code scanning config

Use the renderer when you want a documented `paths-ignore` list for **non-Go** extraction, hand-edited query blocks, or consistency with GitHub code scanning YAML workflows—not for Go path filtering.

```bash
REPO="$(git rev-parse --show-toplevel)"
"$REPO/.cursor/skills/codeql-fix/scripts/render-code-scanning-config.sh" "$REPO" /tmp/codeql-config.yml
codeql database create ./codeql-db --language=go --source-root . --codescanning-config=/tmp/codeql-config.yml --overwrite
```

### 3. Analyze and emit SARIF

```bash
codeql database analyze --format=sarifv2.1.0 --output=codeql-results.sarif -- ./codeql-db codeql/go-queries:codeql-suites/go-security-and-quality.qls
```

- View `codeql-results.sarif` with the SARIF Viewer in VS Code (or upload to GitHub Security tab if your org uses code scanning).
- For a narrower run matching default GitHub code scanning, use `codeql/go-queries:codeql-suites/go-code-scanning.qls` instead.

If `codeql/go-queries` is missing, run `codeql pack download codeql/go-queries` once.

## Fixer loop

If `codeql-results.sarif` has an empty `runs[].results` array, there are **no CodeQL alerts to fix** for that suite; stop unless the user explicitly wants a broader suite or diagnostic queries.

When SARIF findings remain:

1. **Identify:** Read `codeql-results.sarif` or the CLI output for reported findings.
2. **Fix:** Apply the minimum necessary edit to resolve each finding.
3. **Verify:** From the repository root, run the project’s tests and linters (here: `pnpm test`; optionally `pnpm lint` or `pnpm exec trunk check` after substantive edits).
4. **Re-scan:** Repeat database create + analyze (steps 1 and 3 above) until clean or up to 3 iterations to avoid unbounded loops.

## Optional: code scanning config details

See [references/code-scanning-config.md](references/code-scanning-config.md) and the official [code scanning configuration](https://aka.ms/code-scanning-docs/config-file) reference.
