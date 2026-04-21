import { describe, expect, it } from 'vitest';

import {
  classifyRisk,
  csvEscape,
  formatThrownError,
  isBroadScope,
  riskReasonsFromFindings,
} from './index';

describe('common helpers', () => {
  it('detects broad scopes', () => {
    expect(isBroadScope('https://www.googleapis.com/auth/drive')).toBe(true);
    expect(isBroadScope('https://www.googleapis.com/auth/drive.file')).toBe(false);
    expect(isBroadScope('https://www.googleapis.com/auth/drive.appdata')).toBe(false);
    expect(isBroadScope('https://www.googleapis.com/auth/script.projects.readonly')).toBe(false);
  });

  it('classifies risk deterministically', () => {
    expect(
      classifyRisk({
        oauthScopes: ['https://www.googleapis.com/auth/drive'],
        runtimeVersion: 'V8',
        exceptionLogging: 'STACKDRIVER',
        deploymentTypes: [],
        triggerPatterns: ['installable-likely'],
        externalEndpoints: ['https://example.com'],
        usedServices: ['GmailApp'],
        secretSignals: ['apiKey'],
        riskReasons: [],
        riskLevel: 'low',
      }),
    ).toBe('high');
  });

  it('produces stable risk reasons', () => {
    expect(
      riskReasonsFromFindings({
        oauthScopes: ['https://www.googleapis.com/auth/drive'],
        runtimeVersion: null,
        exceptionLogging: null,
        deploymentTypes: [],
        triggerPatterns: ['installable-likely'],
        externalEndpoints: ['https://example.com'],
        usedServices: ['GmailApp'],
        secretSignals: ['token'],
      }),
    ).toEqual([
      'broad_oauth_scopes',
      'embedded_secret_signals',
      'external_http_calls',
      'gmail_access',
      'installable_trigger_usage',
    ]);
  });

  it('does not flag narrow drive scopes as broad risk', () => {
    expect(
      riskReasonsFromFindings({
        oauthScopes: ['https://www.googleapis.com/auth/drive.file'],
        runtimeVersion: null,
        exceptionLogging: null,
        deploymentTypes: [],
        triggerPatterns: [],
        externalEndpoints: [],
        usedServices: [],
        secretSignals: [],
      }),
    ).not.toContain('broad_oauth_scopes');

    expect(
      classifyRisk({
        oauthScopes: ['https://www.googleapis.com/auth/drive.file'],
        runtimeVersion: null,
        exceptionLogging: null,
        deploymentTypes: [],
        triggerPatterns: [],
        externalEndpoints: [],
        usedServices: [],
        secretSignals: [],
        riskReasons: [],
        riskLevel: 'low',
      }),
    ).toBe('low');
  });

  it('escapes CSV content', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('line1\rline2')).toBe('"line1\rline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('formats thrown errors', () => {
    expect(formatThrownError(new Error('x'))).toBe('x');
    expect(formatThrownError('plain')).toBe('plain');
  });
});
