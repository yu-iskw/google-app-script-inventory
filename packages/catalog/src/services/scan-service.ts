import { type ScanFullOptions, formatThrownError } from '@google-app-script-inventory/common';

import type { GoogleWorkspaceClient } from '../providers/google-workspace-client';
import type { CatalogRepository } from '../repository/catalog-repository';
import type { AnalyzerService } from './analyzer';
import { logInfo, logWarn } from './logger';
import type { OptionalAiEnrichmentService } from './optional-ai';

export class ScanService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly google: GoogleWorkspaceClient,
    private readonly analyzer: AnalyzerService,
    private readonly ai: OptionalAiEnrichmentService,
  ) {}

  async runFullScan(options: ScanFullOptions): Promise<void> {
    const runId = this.repository.createScanRun();
    let errorCount = 0;
    const authConfig = {
      adminSubject: options.adminSubject,
      impersonatedServiceAccount: options.impersonatedServiceAccount,
    };
    const users = await this.google.listActiveUsers(authConfig);
    logInfo(`Scanning ${users.length} users for standalone Apps Script projects`);

    for (const user of users) {
      try {
        const observations = await this.google.listStandaloneScriptsForUser(user);
        for (const observation of observations) {
          this.repository.upsertObservation(runId, observation);
        }
      } catch (error) {
        errorCount += 1;
        logWarn(`Failed Drive discovery for ${user}: ${formatThrownError(error)}`);
      }
    }

    const pending = this.repository.listScriptsNeedingEnrichment();
    logInfo(`Enriching ${pending.length} newly discovered scripts`);
    for (const driveFile of pending) {
      try {
        const bundle = await this.google.getProjectBundle(driveFile.discoveredViaUser, driveFile);
        const findings = this.analyzer.analyze(bundle);
        this.repository.upsertDeterministicRecord(runId, bundle, findings);

        if (options.aiMode === 'inline') {
          const result = await this.ai.enrichScript(driveFile.scriptId);
          this.repository.recordAiEnrichment(driveFile.scriptId, result);
        }
      } catch (error) {
        errorCount += 1;
        logWarn(`Failed enrichment for ${driveFile.scriptId}: ${formatThrownError(error)}`);
      }
    }

    this.repository.completeScanRun(runId, {
      userCount: users.length,
      scriptCount: this.repository.listAllScripts().length,
      errorCount,
    });
    logInfo(`Scan ${runId} completed`);
  }
}
