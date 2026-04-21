# Google Apps Script Inventory

Standalone Google Apps Script governance catalog with deterministic extraction and optional Vertex Gemini enrichment.

For development setup and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io/)
- Node.js (see `.node-version`)

Linting and formatting use [Trunk](https://trunk.io/) (ESLint, Prettier, and more). The Trunk **launcher** is installed with project dependencies—you do not need a separate Trunk install for the default workflow.

### Installation

```bash
pnpm install
```

Optional: prefetch Trunk’s hermetic tools (helpful for offline work or CI images):

```bash
pnpm exec trunk install
```

If you prefer a global `trunk` on your PATH, see the [Trunk installation guide](https://docs.trunk.io/references/cli/getting-started/install) (e.g. `brew install trunk-io` on macOS).

### Development

```bash
pnpm dev
```

### Build

```bash
pnpm build
```

### Testing

```bash
pnpm test
```

### Linting & Formatting

```bash
pnpm lint
pnpm format
```

## Project Structure

- `packages/`: Monorepo packages
  - `common/`: Shared types and deterministic helpers
  - `catalog/`: Commander CLI, Google API access, SQLite persistence, exports
  - `catalog-ai/`: Optional Vertex Gemini enrichment provider

## CLI

```bash
pnpm --filter @google-app-script-inventory/catalog build
node packages/catalog/dist/cli.js db migrate
node packages/catalog/dist/cli.js scan full --admin-subject admin@example.com --impersonate-service-account dwd-catalog@example-project.iam.gserviceaccount.com
node packages/catalog/dist/cli.js export json --out ./artifacts/scripts-latest.json
node packages/catalog/dist/cli.js export csv --out ./artifacts/scripts-latest.csv
node packages/catalog/dist/cli.js ai doctor
```

The CLI binary name is `catalog`. After a build, you can also run:

```bash
pnpm --filter @google-app-script-inventory/catalog exec catalog --help
```

Optional AI enrichment uses the Google Gen AI SDK on Vertex AI. Configure it with:

```bash
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
export VERTEX_MODEL=gemini-2.5-pro
```

## Workspace Authentication

The Workspace inventory path uses ADC as the source credential and service account impersonation as the only supported execution path.

Prerequisites:

- ADC is available locally or in the runtime environment
- the ADC principal has `roles/iam.serviceAccountTokenCreator` on the impersonated service account
- the impersonated service account is authorized for domain-wide delegation in Google Admin
- the required Workspace scopes are whitelisted for that service account client ID
- the IAM Credentials API is enabled

Local development example:

```bash
gcloud auth application-default login
node packages/catalog/dist/cli.js scan full \
  --admin-subject admin@example.com \
  --impersonate-service-account dwd-catalog@example-project.iam.gserviceaccount.com
```

The v1 catalog is authoritative for standalone Apps Script projects visible via delegated Drive discovery. Container-bound scripts are an explicit unsupported blind spot.

## License

This project is licensed under the [Apache License 2.0](LICENSE).
