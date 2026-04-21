import type {
  AiAnnotation,
  AiInput,
  AiStatus,
  DeterministicFindings,
  DriveScriptFile,
  EnrichmentResult,
  ProjectBundle,
  ScriptInventoryRow,
} from '@google-app-script-inventory/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class CatalogRepository {
  readonly db: DatabaseSync;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scan_runs (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        error_count INTEGER NOT NULL DEFAULT 0,
        user_count INTEGER NOT NULL DEFAULT 0,
        script_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS scripts (
        script_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        coverage_class TEXT NOT NULL,
        primary_discovered_via_user TEXT NOT NULL,
        owners_json TEXT NOT NULL,
        editors_json TEXT NOT NULL,
        drive_modified_time TEXT,
        drive_id TEXT,
        web_view_link TEXT
      );
      CREATE TABLE IF NOT EXISTS script_observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_run_id TEXT NOT NULL,
        script_id TEXT NOT NULL,
        discovered_via_user TEXT NOT NULL,
        observation_json TEXT NOT NULL,
        UNIQUE(scan_run_id, script_id, discovered_via_user)
      );
      CREATE TABLE IF NOT EXISTS script_bundles (
        script_id TEXT PRIMARY KEY,
        bundle_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS script_findings (
        script_id TEXT PRIMARY KEY,
        scan_run_id TEXT NOT NULL,
        findings_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS script_ai_annotations (
        script_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        provider TEXT,
        annotation_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ai_annotation_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        script_id TEXT NOT NULL,
        provider TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        attempted_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS export_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  createScanRun(): string {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        'INSERT INTO scan_runs (id, started_at, status, error_count, user_count, script_count) VALUES (?, ?, ?, 0, 0, 0)',
      )
      .run(id, new Date().toISOString(), 'running');
    return id;
  }

  completeScanRun(
    id: string,
    summary: { userCount: number; scriptCount: number; errorCount: number },
  ): void {
    this.db
      .prepare(
        'UPDATE scan_runs SET completed_at = ?, status = ?, user_count = ?, script_count = ?, error_count = ? WHERE id = ?',
      )
      .run(
        new Date().toISOString(),
        'completed',
        summary.userCount,
        summary.scriptCount,
        summary.errorCount,
        id,
      );
  }

  upsertObservation(scanRunId: string, observation: DriveScriptFile): void {
    this.db
      .prepare(
        `INSERT INTO scripts
       (script_id, title, coverage_class, primary_discovered_via_user, owners_json, editors_json, drive_modified_time, drive_id, web_view_link)
       VALUES (?, ?, 'standalone_authoritative', ?, ?, ?, ?, ?, ?)
       ON CONFLICT(script_id) DO UPDATE SET
         title = excluded.title,
         primary_discovered_via_user = excluded.primary_discovered_via_user,
         owners_json = excluded.owners_json,
         editors_json = excluded.editors_json,
         drive_modified_time = excluded.drive_modified_time,
         drive_id = excluded.drive_id,
         web_view_link = excluded.web_view_link`,
      )
      .run(
        observation.scriptId,
        observation.name,
        observation.discoveredViaUser,
        JSON.stringify(observation.owners),
        JSON.stringify(observation.editors),
        observation.modifiedTime,
        observation.driveId,
        observation.webViewLink,
      );

    this.db
      .prepare(
        `INSERT INTO script_observations (scan_run_id, script_id, discovered_via_user, observation_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(scan_run_id, script_id, discovered_via_user) DO UPDATE SET observation_json = excluded.observation_json`,
      )
      .run(
        scanRunId,
        observation.scriptId,
        observation.discoveredViaUser,
        JSON.stringify(observation),
      );

    this.db
      .prepare(
        `INSERT INTO script_ai_annotations (script_id, status, provider, annotation_json, updated_at)
       VALUES (?, 'not_requested', NULL, NULL, ?)
       ON CONFLICT(script_id) DO NOTHING`,
      )
      .run(observation.scriptId, new Date().toISOString());
  }

  listScriptsNeedingEnrichment(): DriveScriptFile[] {
    const rows = this.db
      .prepare(
        `SELECT s.script_id, s.title, s.primary_discovered_via_user, s.owners_json, s.editors_json, s.drive_modified_time, s.drive_id, s.web_view_link
         FROM scripts s
         LEFT JOIN script_bundles b ON b.script_id = s.script_id
         WHERE b.script_id IS NULL
         ORDER BY s.script_id`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map(this.rowToDriveFile);
  }

  listAllScripts(): DriveScriptFile[] {
    const rows = this.db
      .prepare(
        `SELECT script_id, title, primary_discovered_via_user, owners_json, editors_json, drive_modified_time, drive_id, web_view_link
         FROM scripts ORDER BY script_id`,
      )
      .all() as Array<Record<string, unknown>>;
    return rows.map(this.rowToDriveFile);
  }

  upsertDeterministicRecord(
    runId: string,
    bundle: ProjectBundle,
    findings: DeterministicFindings,
  ): void {
    this.db
      .prepare(
        'INSERT INTO script_bundles (script_id, bundle_json) VALUES (?, ?) ON CONFLICT(script_id) DO UPDATE SET bundle_json = excluded.bundle_json',
      )
      .run(bundle.scriptId, JSON.stringify(bundle));
    this.db
      .prepare(
        'INSERT INTO script_findings (script_id, scan_run_id, findings_json) VALUES (?, ?, ?) ON CONFLICT(script_id) DO UPDATE SET scan_run_id = excluded.scan_run_id, findings_json = excluded.findings_json',
      )
      .run(bundle.scriptId, runId, JSON.stringify(findings));
  }

  buildAiInput(scriptId: string): AiInput {
    const bundleRow = this.db
      .prepare('SELECT bundle_json FROM script_bundles WHERE script_id = ?')
      .get(scriptId) as { bundle_json: string } | undefined;
    const findingsRow = this.db
      .prepare('SELECT findings_json FROM script_findings WHERE script_id = ?')
      .get(scriptId) as { findings_json: string } | undefined;
    if (!bundleRow || !findingsRow) {
      throw new Error(`Missing bundle or findings for ${scriptId}`);
    }
    const bundle = JSON.parse(bundleRow.bundle_json) as ProjectBundle;
    const findings = JSON.parse(findingsRow.findings_json) as DeterministicFindings;
    return {
      scriptId,
      title: bundle.title,
      deterministicFindings: findings,
      files: bundle.content.files.map((file) => ({
        name: file.name,
        type: file.type,
        source: file.source,
      })),
    };
  }

  listPendingAiScripts(limit?: number): string[] {
    const sql = `SELECT script_id FROM script_ai_annotations WHERE status IN ('not_requested', 'failed', 'unavailable') ORDER BY script_id${
      typeof limit === 'number' ? ` LIMIT ${limit}` : ''
    }`;
    const rows = this.db.prepare(sql).all() as Array<{ script_id: string }>;
    return rows.map((row) => row.script_id);
  }

  recordAiEnrichment(scriptId: string, result: EnrichmentResult): void {
    const now = new Date().toISOString();
    const provider = result.annotation?.provider ?? null;
    this.db
      .prepare(
        `INSERT INTO script_ai_annotations (script_id, status, provider, annotation_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(script_id) DO UPDATE SET
         status = excluded.status,
         provider = excluded.provider,
         annotation_json = excluded.annotation_json,
         updated_at = excluded.updated_at`,
      )
      .run(
        scriptId,
        result.status,
        provider,
        result.annotation ? JSON.stringify(result.annotation) : null,
        now,
      );
    this.db
      .prepare(
        `INSERT INTO ai_annotation_attempts (script_id, provider, status, error_message, attempted_at)
       VALUES (?, ?, ?, ?, ?)`,
      )
      .run(scriptId, provider, result.status, result.errorMessage, now);
  }

  getDatabaseSummary(): Record<string, number> {
    const scalar = (table: string): number =>
      Number(
        (this.db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number })
          .count,
      );
    return {
      scripts: scalar('scripts'),
      findings: scalar('script_findings'),
      aiAnnotations: scalar('script_ai_annotations'),
      runs: scalar('scan_runs'),
    };
  }

  listInventoryRows(): ScriptInventoryRow[] {
    const rows = this.db
      .prepare(
        `SELECT
           s.script_id,
           s.title,
           s.primary_discovered_via_user,
           s.owners_json,
           s.editors_json,
           s.drive_modified_time,
           f.scan_run_id,
           f.findings_json,
           ai.status AS ai_status,
           ai.provider AS ai_provider,
           ai.annotation_json
         FROM scripts s
         JOIN script_findings f ON f.script_id = s.script_id
         LEFT JOIN script_ai_annotations ai ON ai.script_id = s.script_id
         ORDER BY s.script_id`,
      )
      .all() as Array<Record<string, unknown>>;

    return rows.map((row) => {
      const findings = JSON.parse(String(row.findings_json)) as DeterministicFindings;
      const annotation = row.annotation_json
        ? (JSON.parse(String(row.annotation_json)) as AiAnnotation)
        : null;
      return {
        scriptId: String(row.script_id),
        title: String(row.title),
        coverageClass: 'standalone_authoritative',
        discoveredViaUser: String(row.primary_discovered_via_user),
        owners: JSON.parse(String(row.owners_json)) as string[],
        editors: JSON.parse(String(row.editors_json)) as string[],
        driveModifiedTime: row.drive_modified_time ? String(row.drive_modified_time) : null,
        oauthScopes: findings.oauthScopes,
        runtimeVersion: findings.runtimeVersion,
        deploymentTypes: findings.deploymentTypes,
        triggerPatterns: findings.triggerPatterns,
        externalEndpoints: findings.externalEndpoints,
        usedServices: findings.usedServices,
        riskLevel: findings.riskLevel,
        riskReasons: findings.riskReasons,
        aiStatus: (row.ai_status ?? 'not_requested') as AiStatus,
        aiBusinessPurpose: annotation?.businessPurpose ?? null,
        aiOwnerGuess: annotation?.ownerGuess ?? null,
        aiConfidence: annotation?.confidence ?? null,
        aiProvider: row.ai_provider ? String(row.ai_provider) : null,
        scanRunId: String(row.scan_run_id),
      };
    });
  }

  recordExport(kind: 'json' | 'csv', path: string, rowCount: number): void {
    this.db
      .prepare(
        'INSERT INTO export_snapshots (kind, path, row_count, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(kind, path, rowCount, new Date().toISOString());
  }

  writeFile(path: string, content: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf8');
  }

  private rowToDriveFile(row: Record<string, unknown>): DriveScriptFile {
    return {
      scriptId: String(row.script_id),
      name: String(row.title),
      owners: JSON.parse(String(row.owners_json)) as string[],
      editors: JSON.parse(String(row.editors_json)) as string[],
      modifiedTime: row.drive_modified_time ? String(row.drive_modified_time) : null,
      driveId: row.drive_id ? String(row.drive_id) : null,
      webViewLink: row.web_view_link ? String(row.web_view_link) : null,
      discoveredViaUser: String(row.primary_discovered_via_user),
    };
  }
}
