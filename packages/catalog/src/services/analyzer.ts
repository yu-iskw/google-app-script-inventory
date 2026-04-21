import type {
  DeploymentType,
  DeterministicFindings,
  ProjectBundle,
  ScriptFile,
} from '@google-app-script-inventory/common';
import {
  classifyRisk,
  riskReasonsFromFindings,
  stableStringArray,
} from '@google-app-script-inventory/common';

const RESERVED_TRIGGER_NAMES = new Set(['onOpen', 'onEdit', 'onInstall', 'doGet', 'doPost']);
const FETCH_LITERAL_RE = /UrlFetchApp\.fetch\(\s*["'`](https?:\/\/[^"'`]+)["'`]/g;
const SERVICE_PATTERNS = [
  'AdminDirectory',
  'CalendarApp',
  'DocumentApp',
  'DriveApp',
  'FormApp',
  'GmailApp',
  'Jdbc',
  'MailApp',
  'PropertiesService',
  'Sheets',
  'SpreadsheetApp',
  'UrlFetchApp',
] as const;
const SECRET_PATTERNS = [/api[_-]?key/i, /secret/i, /token/i, /password/i];

function isManifestFile(file: ScriptFile): boolean {
  return file.name === 'appsscript' && file.type === 'JSON';
}

function parseManifest(bundle: ProjectBundle): Record<string, unknown> {
  const manifest = bundle.content.files.find(isManifestFile);
  if (!manifest) return {};
  try {
    return JSON.parse(manifest.source) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractDeploymentTypes(bundle: ProjectBundle): DeploymentType[] {
  const found = new Set<DeploymentType>();
  for (const deployment of bundle.deployments) {
    for (const entryPoint of deployment.entryPoints) {
      switch (entryPoint.entryPointType) {
        case 'WEB_APP':
          found.add('webapp');
          break;
        case 'EXECUTION_API':
          found.add('execution_api');
          break;
        case 'ADD_ON':
          found.add('add_on');
          break;
        case 'LIBRARY':
          found.add('library');
          break;
        default:
          break;
      }
    }
  }
  return [...found].sort();
}

export function detectTriggerPatterns(files: ScriptFile[]): string[] {
  const found = new Set<string>();

  for (const file of files) {
    for (const name of RESERVED_TRIGGER_NAMES) {
      if (new RegExp(`function\\s+${name}\\s*\\(`).test(file.source)) {
        found.add(name);
      }
    }
    if (file.source.includes('ScriptApp.newTrigger(')) {
      found.add('installable-likely');
    }
  }

  return [...found].sort((a, b) => a.localeCompare(b));
}

export function extractExternalEndpoints(
  files: ScriptFile[],
  manifestWhitelist: string[],
): string[] {
  const urls = new Set<string>(manifestWhitelist);

  for (const file of files) {
    for (const match of file.source.matchAll(FETCH_LITERAL_RE)) {
      urls.add(match[1]);
    }
  }

  return stableStringArray(urls);
}

function extractUsedServices(files: ScriptFile[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const service of SERVICE_PATTERNS) {
      if (file.source.includes(service)) {
        found.add(service);
      }
    }
  }
  return stableStringArray(found);
}

function extractSecretSignals(files: ScriptFile[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(file.source)) {
        found.add(pattern.source);
      }
    }
  }
  return stableStringArray(found);
}

export class AnalyzerService {
  analyze(bundle: ProjectBundle): DeterministicFindings {
    const manifest = parseManifest(bundle);
    const oauthScopes = Array.isArray(manifest.oauthScopes)
      ? stableStringArray(
          manifest.oauthScopes.filter((value): value is string => typeof value === 'string'),
        )
      : [];
    const runtimeVersion =
      typeof manifest.runtimeVersion === 'string' ? manifest.runtimeVersion : null;
    const exceptionLogging =
      typeof manifest.exceptionLogging === 'string' ? manifest.exceptionLogging : null;
    const whitelist = Array.isArray(manifest.urlFetchWhitelist)
      ? stableStringArray(
          manifest.urlFetchWhitelist.filter((value): value is string => typeof value === 'string'),
        )
      : [];
    const deploymentTypes = extractDeploymentTypes(bundle);
    const triggerPatterns = detectTriggerPatterns(bundle.content.files);
    const externalEndpoints = extractExternalEndpoints(bundle.content.files, whitelist);
    const usedServices = extractUsedServices(bundle.content.files);
    const secretSignals = extractSecretSignals(bundle.content.files);

    const partial = {
      oauthScopes,
      runtimeVersion,
      exceptionLogging,
      deploymentTypes,
      triggerPatterns,
      externalEndpoints,
      usedServices,
      secretSignals,
    };

    return {
      ...partial,
      riskReasons: riskReasonsFromFindings(partial),
      riskLevel: classifyRisk({ ...partial, riskReasons: [], riskLevel: 'low' }),
    };
  }
}
