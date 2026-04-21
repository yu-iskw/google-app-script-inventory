import {
  DEFAULT_VERTEX_GEMINI_PROVIDER_ID,
  type AiAnnotation,
  type AiEnrichmentProvider,
  type AiInput,
} from '@google-app-script-inventory/common';
import { GoogleGenAI, type Schema, Type } from '@google/genai';

export interface VertexGeminiConfig {
  projectId: string;
  location: string;
  model: string;
}

interface GenerateContentClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config: {
        responseMimeType: 'application/json';
        responseSchema: Schema;
      };
    }): Promise<{ text?: string | undefined }>;
  };
}

const ANNOTATION_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    businessPurpose: { type: Type.STRING, nullable: true },
    ownerGuess: { type: Type.STRING, nullable: true },
    ownerGuessBasis: { type: Type.STRING, nullable: true },
    businessDomain: { type: Type.STRING, nullable: true },
    confidence: { type: Type.NUMBER, nullable: true },
  },
  required: ['businessPurpose', 'ownerGuess', 'ownerGuessBasis', 'businessDomain', 'confidence'],
  propertyOrdering: [
    'businessPurpose',
    'ownerGuess',
    'ownerGuessBasis',
    'businessDomain',
    'confidence',
  ],
};

function buildPrompt(input: AiInput): string {
  return JSON.stringify(
    {
      instructions: [
        'Summarize business purpose in at most two sentences.',
        'Guess likely owner or team only if there is evidence.',
        'Do not overwrite or reinterpret deterministic findings.',
        'Return only JSON that matches the response schema.',
      ],
      input,
    },
    null,
    2,
  );
}

function parseAnnotation(rawText: string, provider: string, model: string): AiAnnotation {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  return {
    businessPurpose: typeof parsed.businessPurpose === 'string' ? parsed.businessPurpose : null,
    ownerGuess: typeof parsed.ownerGuess === 'string' ? parsed.ownerGuess : null,
    ownerGuessBasis: typeof parsed.ownerGuessBasis === 'string' ? parsed.ownerGuessBasis : null,
    businessDomain: typeof parsed.businessDomain === 'string' ? parsed.businessDomain : null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
    provider,
    model,
    promptVersion: 'v1',
  };
}

export class VertexGeminiProvider implements AiEnrichmentProvider {
  readonly name = DEFAULT_VERTEX_GEMINI_PROVIDER_ID;

  private readonly config: VertexGeminiConfig;
  private readonly client?: GenerateContentClient;

  constructor(config: VertexGeminiConfig, client?: GenerateContentClient) {
    this.config = config;
    this.client = client;
  }

  async isConfigured(): Promise<boolean> {
    return Boolean(this.config.projectId && this.config.location && this.config.model);
  }

  private getClient(): GenerateContentClient {
    return (
      this.client ??
      new GoogleGenAI({
        vertexai: true,
        project: this.config.projectId,
        location: this.config.location,
        apiVersion: 'v1',
      })
    );
  }

  async summarize(input: AiInput): Promise<AiAnnotation> {
    const response = await this.getClient().models.generateContent({
      model: this.config.model,
      contents: buildPrompt(input),
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANNOTATION_RESPONSE_SCHEMA,
      },
    });
    const text = response.text?.trim() ?? '';
    if (!text) {
      throw new Error('Vertex Gemini returned an empty response');
    }
    return parseAnnotation(text, this.name, this.config.model);
  }
}

export function createVertexGeminiProviderFromEnv(): AiEnrichmentProvider {
  return new VertexGeminiProvider({
    projectId: process.env.GOOGLE_CLOUD_PROJECT ?? '',
    location: process.env.GOOGLE_CLOUD_LOCATION ?? '',
    model: process.env.VERTEX_MODEL ?? 'gemini-2.5-pro',
  });
}
