import type {
  AiDoctorOptions,
  AiEnrichPendingOptions,
  ExportOptions,
  GlobalCliOptions,
  ScanFullOptions,
} from '@google-app-script-inventory/common';

import { createAiProviderFromEnv } from './providers/ai-provider-loader';
import { GoogleWorkspaceClient } from './providers/google-workspace-client';
import { WorkspaceImpersonatedAuthProvider } from './providers/workspace-delegated-auth';
import { CatalogRepository } from './repository/catalog-repository';
import { AnalyzerService } from './services/analyzer';
import { ExportService } from './services/exporter';
import { OptionalAiEnrichmentService } from './services/optional-ai';
import { ScanService } from './services/scan-service';
import { logInfo } from './services/logger';

export async function createApplication(globals: GlobalCliOptions) {
  const repository = new CatalogRepository(globals.dbPath);
  repository.migrate();
  const analyzer = new AnalyzerService();
  const exporter = new ExportService(repository);
  const aiProvider = await createAiProviderFromEnv();
  const optionalAi = new OptionalAiEnrichmentService(aiProvider, repository);

  return {
    async dbMigrate(): Promise<void> {
      logInfo(`Database migrated at ${globals.dbPath}`);
    },
    async dbDoctor(): Promise<void> {
      const summary = repository.getDatabaseSummary();
      logInfo(`Database ready at ${globals.dbPath}`);
      logInfo(JSON.stringify(summary, null, 2));
    },
    async scanFull(options: ScanFullOptions): Promise<void> {
      const google = new GoogleWorkspaceClient(
        new WorkspaceImpersonatedAuthProvider(options.impersonatedServiceAccount),
      );
      const scanService = new ScanService(repository, google, analyzer, optionalAi);
      await scanService.runFullScan(options);
    },
    exportJson(options: ExportOptions): void {
      exporter.exportJson(options.out);
    },
    exportCsv(options: ExportOptions): void {
      exporter.exportCsv(options.out);
    },
    async aiDoctor(options: AiDoctorOptions): Promise<void> {
      const available = await optionalAi.doctor(options.provider);
      logInfo(
        JSON.stringify(
          {
            provider: options.provider,
            configured: available.configured,
            detail: available.detail,
          },
          null,
          2,
        ),
      );
    },
    async aiEnrichPending(options: AiEnrichPendingOptions): Promise<void> {
      const result = await optionalAi.enrichPending(options.limit);
      logInfo(JSON.stringify(result, null, 2));
    },
  };
}
