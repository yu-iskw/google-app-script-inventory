# `@google-app-script-inventory/catalog-ai`

Optional **Vertex AI** enrichment provider for the catalog. It implements `AiEnrichmentProvider` from [`@google-app-script-inventory/common`](../common/) using the Google Gen AI SDK with Vertex AI.

## Relationship to `catalog`

`catalog` lists this package as an **optionalDependency** and loads it dynamically. If `catalog-ai` is not installed, or the provider is not configured, AI-related CLI paths report unavailable or skipped behavior rather than failing the core scan.

## Configuration

`createVertexGeminiProviderFromEnv()` reads:

| Variable                | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `GOOGLE_CLOUD_PROJECT`  | GCP project id                                   |
| `GOOGLE_CLOUD_LOCATION` | Vertex region (for example `us-central1`)        |
| `VERTEX_MODEL`          | Model id (defaults to `gemini-2.5-pro` if unset) |

The root [README](../../README.md) includes a minimal export block for optional AI enrichment alongside other environment variables.

## Build

```bash
pnpm --filter @google-app-script-inventory/catalog-ai build
```

For CLI usage and contributor setup, see the [root README](../../README.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md).
