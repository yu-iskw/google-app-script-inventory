import { formatCsvRow, type ScriptInventoryRow } from '@google-app-script-inventory/common';

import type { CatalogRepository } from '../repository/catalog-repository';

const CSV_HEADERS = [
  'scriptId',
  'title',
  'coverageClass',
  'discoveredViaUser',
  'owners',
  'editors',
  'driveModifiedTime',
  'oauthScopes',
  'runtimeVersion',
  'deploymentTypes',
  'triggerPatterns',
  'externalEndpoints',
  'usedServices',
  'riskLevel',
  'riskReasons',
  'aiStatus',
  'aiBusinessPurpose',
  'aiOwnerGuess',
  'aiConfidence',
  'aiProvider',
  'scanRunId',
] as const;

const jsonArray = (values: string[]) => JSON.stringify(values);

function rowToCsvValues(row: ScriptInventoryRow): Array<string | number | null> {
  return [
    row.scriptId,
    row.title,
    row.coverageClass,
    row.discoveredViaUser,
    jsonArray(row.owners),
    jsonArray(row.editors),
    row.driveModifiedTime,
    jsonArray(row.oauthScopes),
    row.runtimeVersion,
    jsonArray(row.deploymentTypes),
    jsonArray(row.triggerPatterns),
    jsonArray(row.externalEndpoints),
    jsonArray(row.usedServices),
    row.riskLevel,
    jsonArray(row.riskReasons),
    row.aiStatus,
    row.aiBusinessPurpose,
    row.aiOwnerGuess,
    row.aiConfidence,
    row.aiProvider,
    row.scanRunId,
  ];
}

export class ExportService {
  constructor(private readonly repository: CatalogRepository) {}

  exportJson(path: string): void {
    const rows = this.repository.listInventoryRows();
    this.repository.writeFile(path, `${JSON.stringify(rows, null, 2)}\n`);
    this.repository.recordExport('json', path, rows.length);
  }

  exportCsv(path: string): void {
    const rows = this.repository.listInventoryRows();
    const lines = [formatCsvRow([...CSV_HEADERS])];
    for (const row of rows) {
      lines.push(formatCsvRow(rowToCsvValues(row)));
    }
    this.repository.writeFile(path, `${lines.join('\n')}\n`);
    this.repository.recordExport('csv', path, rows.length);
  }
}
