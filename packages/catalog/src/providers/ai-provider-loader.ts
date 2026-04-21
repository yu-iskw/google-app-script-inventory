import {
  DEFAULT_VERTEX_GEMINI_PROVIDER_ID,
  type AiEnrichmentProvider,
} from '@google-app-script-inventory/common';

export async function createAiProviderFromEnv(): Promise<AiEnrichmentProvider | null> {
  if (
    (process.env.AI_PROVIDER ?? DEFAULT_VERTEX_GEMINI_PROVIDER_ID) !==
    DEFAULT_VERTEX_GEMINI_PROVIDER_ID
  ) {
    return null;
  }

  try {
    const module = await import('@google-app-script-inventory/catalog-ai');
    return module.createVertexGeminiProviderFromEnv();
  } catch {
    return null;
  }
}
