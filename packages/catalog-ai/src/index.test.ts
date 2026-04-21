import { afterEach, describe, expect, it } from 'vitest';

import type { AiInput } from '@google-app-script-inventory/common';
import { OptionalAiEnrichmentService } from '../../catalog/src/services/optional-ai';

import { VertexGeminiProvider, createVertexGeminiProviderFromEnv } from './index';

const ORIGINAL_ENV = {
  GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
  GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
  VERTEX_MODEL: process.env.VERTEX_MODEL,
  VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID,
  VERTEX_LOCATION: process.env.VERTEX_LOCATION,
};

const INPUT: AiInput = {
  scriptId: 'script-1',
  title: 'Example Script',
  deterministicFindings: {
    oauthScopes: ['https://www.googleapis.com/auth/drive.readonly'],
    runtimeVersion: 'V8',
    exceptionLogging: 'STACKDRIVER',
    deploymentTypes: ['webapp'],
    triggerPatterns: ['onOpen'],
    externalEndpoints: ['https://api.example.com'],
    usedServices: ['DriveApp'],
    secretSignals: [],
    riskReasons: ['external_http_calls'],
    riskLevel: 'medium',
  },
  files: [{ name: 'Code.gs', type: 'SERVER_JS', source: 'function onOpen() {}' }],
};

afterEach(() => {
  process.env.GOOGLE_CLOUD_PROJECT = ORIGINAL_ENV.GOOGLE_CLOUD_PROJECT;
  process.env.GOOGLE_CLOUD_LOCATION = ORIGINAL_ENV.GOOGLE_CLOUD_LOCATION;
  process.env.VERTEX_MODEL = ORIGINAL_ENV.VERTEX_MODEL;
  process.env.VERTEX_PROJECT_ID = ORIGINAL_ENV.VERTEX_PROJECT_ID;
  process.env.VERTEX_LOCATION = ORIGINAL_ENV.VERTEX_LOCATION;
});

describe('catalog-ai', () => {
  it('creates an unconfigured provider by default', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_LOCATION;
    delete process.env.VERTEX_MODEL;
    const provider = createVertexGeminiProviderFromEnv();
    expect(await provider.isConfigured()).toBe(false);
  });

  it('creates a configured provider from GOOGLE_CLOUD_* env vars', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
    process.env.GOOGLE_CLOUD_LOCATION = 'us-central1';
    process.env.VERTEX_MODEL = 'gemini-2.5-pro';
    const provider = createVertexGeminiProviderFromEnv();
    expect(await provider.isConfigured()).toBe(true);
  });

  it('does not read deprecated VERTEX_PROJECT_ID or VERTEX_LOCATION env vars', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_LOCATION;
    process.env.VERTEX_PROJECT_ID = 'deprecated-project';
    process.env.VERTEX_LOCATION = 'deprecated-location';
    process.env.VERTEX_MODEL = 'gemini-2.5-pro';
    const provider = createVertexGeminiProviderFromEnv();
    expect(await provider.isConfigured()).toBe(false);
  });

  it('parses structured JSON model output into an annotation', async () => {
    const provider = new VertexGeminiProvider(
      { projectId: 'test-project', location: 'us-central1', model: 'gemini-2.5-pro' },
      {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              businessPurpose: 'Tracks script inventory state for governance.',
              ownerGuess: 'Platform Engineering',
              ownerGuessBasis: 'The title and file contents reference inventory operations.',
              businessDomain: 'governance',
              confidence: 0.82,
            }),
          }),
        },
      },
    );

    await expect(provider.summarize(INPUT)).resolves.toEqual({
      businessPurpose: 'Tracks script inventory state for governance.',
      ownerGuess: 'Platform Engineering',
      ownerGuessBasis: 'The title and file contents reference inventory operations.',
      businessDomain: 'governance',
      confidence: 0.82,
      provider: 'vertex-gemini',
      model: 'gemini-2.5-pro',
      promptVersion: 'v1',
    });
  });

  it('throws when the model response text is empty', async () => {
    const provider = new VertexGeminiProvider(
      { projectId: 'test-project', location: 'us-central1', model: 'gemini-2.5-pro' },
      {
        models: {
          generateContent: async () => ({ text: '   ' }),
        },
      },
    );

    await expect(provider.summarize(INPUT)).rejects.toThrow(
      'Vertex Gemini returned an empty response',
    );
  });

  it('surfaces invalid JSON as a failed enrichment result', async () => {
    const provider = new VertexGeminiProvider(
      { projectId: 'test-project', location: 'us-central1', model: 'gemini-2.5-pro' },
      {
        models: {
          generateContent: async () => ({ text: '{"businessPurpose": "oops"' }),
        },
      },
    );

    const service = new OptionalAiEnrichmentService(provider, {
      buildAiInput: () => INPUT,
      listPendingAiScripts: () => [],
      recordAiEnrichment: () => undefined,
    } as unknown as ConstructorParameters<typeof OptionalAiEnrichmentService>[1]);

    const result = await service.enrichScript(INPUT.scriptId);
    expect(result).toMatchObject({
      status: 'failed',
      annotation: null,
    });
    expect(result.errorMessage).toMatch(/JSON|Unexpected end|Expected ',' or '}'/);
  });
});
