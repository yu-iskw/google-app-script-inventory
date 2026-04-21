# Code scanning config (template + renderer)

This skill ships a YAML template and a small shell renderer under the same directory as [`SKILL.md`](../SKILL.md).

- **Template:** [`assets/code-scanning-config.template.yml`](../assets/code-scanning-config.template.yml)
- **Renderer:** [`scripts/render-code-scanning-config.sh`](../scripts/render-code-scanning-config.sh)

Local CodeQL in this repository is **CLI-driven** (no `pnpm` or root npm scripts). Use [`SKILL.md`](../SKILL.md) for the full `database create` / `database analyze` flow.

Pass the rendered file to `codeql database create --codescanning-config=<file>` when you need `paths-ignore` or other [code scanning configuration](https://aka.ms/code-scanning-docs/config-file) options beyond a bare `--source-root .` create.

**Go caveat:** CodeQL may emit a diagnostic that `paths` / `paths-ignore` have **no effect for the Go extractor** (path-based filtering is not applied the same way as for some other languages). The renderer still emits valid YAML (glob patterns like `**/.venv` are **double-quoted** so the file parses). To drop alerts from certain paths in SARIF, use something like [advanced-security/filter-sarif](https://github.com/advanced-security/filter-sarif) after analysis.
