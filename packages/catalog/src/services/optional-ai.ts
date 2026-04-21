import {
  formatThrownError,
  type AiEnrichmentProvider,
  type AiEnrichmentService,
  type EnrichmentBatchResult,
  type EnrichmentResult,
} from '@google-app-script-inventory/common';

import type { CatalogRepository } from '../repository/catalog-repository';

export class OptionalAiEnrichmentService implements AiEnrichmentService {
  constructor(
    private readonly provider: AiEnrichmentProvider | null,
    private readonly repository: CatalogRepository,
  ) {}

  async doctor(expectedProvider: string): Promise<{ configured: boolean; detail: string }> {
    if (!this.provider) {
      return {
        configured: false,
        detail: `${expectedProvider} package is unavailable or not installed`,
      };
    }
    const configured = await this.provider.isConfigured();
    return {
      configured,
      detail: configured
        ? `${this.provider.name} is configured`
        : `${this.provider.name} is not configured`,
    };
  }

  async enrichScript(scriptId: string): Promise<EnrichmentResult> {
    if (!this.provider) {
      return { status: 'disabled', annotation: null, errorMessage: null };
    }

    if (!(await this.provider.isConfigured())) {
      return { status: 'unavailable', annotation: null, errorMessage: 'Provider not configured' };
    }

    const input = this.repository.buildAiInput(scriptId);

    try {
      const annotation = await this.provider.summarize(input);
      return { status: 'complete', annotation, errorMessage: null };
    } catch (error) {
      return {
        status: 'failed',
        annotation: null,
        errorMessage: formatThrownError(error),
      };
    }
  }

  async enrichPending(limit?: number): Promise<EnrichmentBatchResult> {
    const results: EnrichmentResult[] = [];
    for (const scriptId of this.repository.listPendingAiScripts(limit)) {
      const result = await this.enrichScript(scriptId);
      this.repository.recordAiEnrichment(scriptId, result);
      results.push(result);
    }
    return { processed: results.length, results };
  }
}
