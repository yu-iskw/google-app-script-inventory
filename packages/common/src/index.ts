export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/script.projects.readonly',
] as const;

/** Subsets of {@link GOOGLE_SCOPES} for Directory, Drive, and Apps Script APIs (single source of truth). */
export const GOOGLE_SCOPES_DIRECTORY = [GOOGLE_SCOPES[0]] as const;
export const GOOGLE_SCOPES_DRIVE = [GOOGLE_SCOPES[1]] as const;
export const GOOGLE_SCOPES_SCRIPT = [GOOGLE_SCOPES[2]] as const;

export const DEFAULT_VERTEX_GEMINI_PROVIDER_ID = 'vertex-gemini' as const;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type CoverageClass = 'standalone_authoritative' | 'unsupported_bound_unknown';
export type RiskLevel = 'low' | 'medium' | 'high';
export type AiStatus =
  | 'not_requested'
  | 'disabled'
  | 'pending'
  | 'complete'
  | 'failed'
  | 'unavailable';
export type DeploymentType = 'webapp' | 'add_on' | 'execution_api' | 'library';

export interface GlobalCliOptions {
  dbPath: string;
  logLevel: LogLevel;
}

export interface ScanFullOptions extends GlobalCliOptions {
  adminSubject: string;
  impersonatedServiceAccount: string;
  aiMode: 'off' | 'inline';
}

export interface ExportOptions extends GlobalCliOptions {
  out: string;
}

export interface AiEnrichPendingOptions extends GlobalCliOptions {
  provider: typeof DEFAULT_VERTEX_GEMINI_PROVIDER_ID;
  limit?: number;
}

export interface AiDoctorOptions extends GlobalCliOptions {
  provider: typeof DEFAULT_VERTEX_GEMINI_PROVIDER_ID;
}

export type DbCommandOptions = GlobalCliOptions;

export interface DriveScriptFile {
  scriptId: string;
  name: string;
  owners: string[];
  editors: string[];
  modifiedTime: string | null;
  driveId: string | null;
  webViewLink: string | null;
  discoveredViaUser: string;
}

export interface ScriptFile {
  name: string;
  type: string;
  source: string;
}

export interface ScriptProjectMetadata {
  scriptId: string;
  title: string;
  createTime?: string;
  updateTime?: string;
  parentId?: string;
}

export interface ScriptDeployment {
  deploymentId: string;
  entryPoints: Array<{
    entryPointType?: string;
  }>;
}

export interface ScriptVersion {
  versionNumber: number;
  description?: string;
  createTime?: string;
}

export interface ScriptProjectContent {
  scriptId: string;
  files: ScriptFile[];
}

export interface ProjectBundle {
  scriptId: string;
  title: string;
  driveFile: DriveScriptFile;
  project: ScriptProjectMetadata;
  content: ScriptProjectContent;
  deployments: ScriptDeployment[];
  versions: ScriptVersion[];
}

export interface DeterministicFindings {
  oauthScopes: string[];
  runtimeVersion: string | null;
  exceptionLogging: string | null;
  deploymentTypes: DeploymentType[];
  triggerPatterns: string[];
  externalEndpoints: string[];
  usedServices: string[];
  secretSignals: string[];
  riskReasons: string[];
  riskLevel: RiskLevel;
}

export interface AiInput {
  scriptId: string;
  title: string;
  deterministicFindings: DeterministicFindings;
  files: Array<{ name: string; type: string; source: string }>;
}

export interface AiAnnotation {
  businessPurpose: string | null;
  ownerGuess: string | null;
  ownerGuessBasis: string | null;
  businessDomain: string | null;
  confidence: number | null;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface EnrichmentResult {
  status: 'complete' | 'disabled' | 'failed' | 'unavailable';
  annotation: AiAnnotation | null;
  errorMessage: string | null;
}

export interface EnrichmentBatchResult {
  processed: number;
  results: EnrichmentResult[];
}

export interface AiEnrichmentProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  summarize(input: AiInput): Promise<AiAnnotation>;
}

export interface AiEnrichmentService {
  enrichScript(scriptId: string): Promise<EnrichmentResult>;
  enrichPending(limit?: number): Promise<EnrichmentBatchResult>;
}

export interface WorkspaceDelegatedAuthConfig {
  adminSubject: string;
  impersonatedServiceAccount: string;
}

export interface WorkspaceAccessToken {
  accessToken: string;
  expiryDate: number | null;
}

export interface WorkspaceDelegatedAuthProvider {
  getAccessToken(subject: string, scopes: string[]): Promise<WorkspaceAccessToken>;
}

export interface ScriptInventoryRow {
  scriptId: string;
  title: string;
  coverageClass: 'standalone_authoritative';
  discoveredViaUser: string;
  owners: string[];
  editors: string[];
  driveModifiedTime: string | null;
  oauthScopes: string[];
  runtimeVersion: string | null;
  deploymentTypes: DeploymentType[];
  triggerPatterns: string[];
  externalEndpoints: string[];
  usedServices: string[];
  riskLevel: RiskLevel;
  riskReasons: string[];
  aiStatus: AiStatus;
  aiBusinessPurpose: string | null;
  aiOwnerGuess: string | null;
  aiConfidence: number | null;
  aiProvider: string | null;
  scanRunId: string;
}

export const BROAD_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/admin.directory.user',
] as const;

export function isBroadScope(scope: string): boolean {
  return BROAD_SCOPES.includes(scope as (typeof BROAD_SCOPES)[number]);
}

export function classifyRisk(f: DeterministicFindings): RiskLevel {
  let score = 0;
  if (f.oauthScopes.some(isBroadScope)) score += 35;
  if (f.externalEndpoints.length > 0) score += 20;
  if (f.usedServices.includes('GmailApp')) score += 10;
  if (f.usedServices.includes('AdminDirectory')) score += 20;
  if (f.secretSignals.length > 0) score += 25;
  if (f.triggerPatterns.includes('installable-likely')) score += 10;

  if (score >= 60) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export function riskReasonsFromFindings(
  f: Omit<DeterministicFindings, 'riskLevel' | 'riskReasons'>,
): string[] {
  const reasons = new Set<string>();
  if (f.oauthScopes.some(isBroadScope)) reasons.add('broad_oauth_scopes');
  if (f.externalEndpoints.length > 0) reasons.add('external_http_calls');
  if (f.usedServices.includes('GmailApp')) reasons.add('gmail_access');
  if (f.usedServices.includes('AdminDirectory')) reasons.add('admin_directory_access');
  if (f.secretSignals.length > 0) reasons.add('embedded_secret_signals');
  if (f.triggerPatterns.includes('installable-likely')) reasons.add('installable_trigger_usage');
  return [...reasons].sort();
}

export function stableStringArray(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

export function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer: ${value}`);
  }
  return parsed;
}

export function formatThrownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function csvEscape(value: string): string {
  if (/["\r\n,]/.test(value)) {
    return `"${value.split('"').join('""')}"`;
  }
  return value;
}

export function formatCsvRow(values: Array<string | number | null>): string {
  return values
    .map((value) => {
      if (value === null) return '';
      return csvEscape(String(value));
    })
    .join(',');
}
