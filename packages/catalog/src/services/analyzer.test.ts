import { describe, expect, it } from 'vitest';

import type { ProjectBundle } from '@google-app-script-inventory/common';

import { AnalyzerService, detectTriggerPatterns, extractExternalEndpoints } from './analyzer';

const bundle: ProjectBundle = {
  scriptId: 'script-1',
  title: 'Example',
  driveFile: {
    scriptId: 'script-1',
    name: 'Example',
    owners: ['owner@example.com'],
    editors: ['editor@example.com'],
    modifiedTime: '2026-01-01T00:00:00.000Z',
    driveId: null,
    webViewLink: 'https://script.google.com',
    discoveredViaUser: 'user@example.com',
  },
  project: {
    scriptId: 'script-1',
    title: 'Example',
  },
  content: {
    scriptId: 'script-1',
    files: [
      {
        name: 'Code',
        type: 'SERVER_JS',
        source:
          'function onOpen() {}\nScriptApp.newTrigger("sync").timeBased();\nUrlFetchApp.fetch("https://api.example.com");\nGmailApp.sendEmail("a","b","c");\nconst apiKey = "secret";',
      },
      {
        name: 'appsscript',
        type: 'JSON',
        source: JSON.stringify({
          timeZone: 'UTC',
          exceptionLogging: 'STACKDRIVER',
          runtimeVersion: 'V8',
          oauthScopes: ['https://www.googleapis.com/auth/drive'],
          urlFetchWhitelist: ['https://whitelist.example.com'],
        }),
      },
    ],
  },
  deployments: [
    {
      deploymentId: 'deployment-1',
      entryPoints: [{ entryPointType: 'WEB_APP' }],
    },
  ],
  versions: [],
};

describe('analyzer', () => {
  it('detects triggers', () => {
    expect(detectTriggerPatterns(bundle.content.files)).toEqual(['installable-likely', 'onOpen']);
  });

  it('extracts endpoints', () => {
    expect(
      extractExternalEndpoints(bundle.content.files, ['https://whitelist.example.com']),
    ).toEqual(['https://api.example.com', 'https://whitelist.example.com']);
  });

  it('creates deterministic findings', () => {
    const findings = new AnalyzerService().analyze(bundle);
    expect(findings.runtimeVersion).toBe('V8');
    expect(findings.deploymentTypes).toEqual(['webapp']);
    expect(findings.riskLevel).toBe('high');
  });
});
