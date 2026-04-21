import { OAuth2Client } from 'google-auth-library';
import { describe, expect, it, vi } from 'vitest';

import type {
  DriveScriptFile,
  WorkspaceDelegatedAuthConfig,
  WorkspaceDelegatedAuthProvider,
} from '@google-app-script-inventory/common';

import { GoogleWorkspaceClient, type WorkspaceApiFactory } from './google-workspace-client';

describe('google workspace client', () => {
  it('uses admin subject for Directory and per-user tokens for Drive and Script', async () => {
    const accessTokenCalls: Array<{ subject: string; scopes: string[] }> = [];
    const authProvider: WorkspaceDelegatedAuthProvider = {
      async getAccessToken(subject, scopes) {
        accessTokenCalls.push({ subject, scopes });
        return {
          accessToken: `token-for-${subject}`,
          expiryDate: Date.now() + 60_000,
        };
      },
    };

    const adminList = vi.fn().mockResolvedValue({
      data: { users: [{ primaryEmail: 'user@example.com', suspended: false }] },
    });
    const driveList = vi.fn().mockResolvedValue({
      data: {
        files: [
          {
            id: 'script-1',
            name: 'Script 1',
            owners: [{ emailAddress: 'owner@example.com' }],
            permissions: [{ emailAddress: 'editor@example.com', role: 'writer' }],
            modifiedTime: '2026-01-01T00:00:00.000Z',
            driveId: null,
            webViewLink: 'https://example.com/script-1',
          },
        ],
      },
    });
    const scriptGet = vi.fn().mockResolvedValue({ data: { title: 'Script 1' } });
    const scriptContent = vi.fn().mockResolvedValue({
      data: { files: [{ name: 'Code', type: 'SERVER_JS', source: 'function onOpen() {}' }] },
    });
    const scriptDeployments = vi.fn().mockResolvedValue({ data: { deployments: [] } });
    const scriptVersions = vi.fn().mockResolvedValue({ data: { versions: [] } });

    const apiFactory: WorkspaceApiFactory = {
      createAdmin(auth) {
        expect(auth).toBeInstanceOf(OAuth2Client);
        return { users: { list: adminList } } as never;
      },
      createDrive(auth) {
        expect(auth).toBeInstanceOf(OAuth2Client);
        return { files: { list: driveList } } as never;
      },
      createScript(auth) {
        expect(auth).toBeInstanceOf(OAuth2Client);
        return {
          projects: {
            get: scriptGet,
            getContent: scriptContent,
            deployments: { list: scriptDeployments },
            versions: { list: scriptVersions },
          },
        } as never;
      },
    };

    const client = new GoogleWorkspaceClient(authProvider, apiFactory);
    const authConfig: WorkspaceDelegatedAuthConfig = {
      adminSubject: 'admin@example.com',
      impersonatedServiceAccount: 'dwd@example-project.iam.gserviceaccount.com',
    };

    const users = await client.listActiveUsers(authConfig);
    expect(users).toEqual(['user@example.com']);

    const scripts = await client.listStandaloneScriptsForUser('user@example.com');
    expect(scripts).toEqual([
      {
        scriptId: 'script-1',
        name: 'Script 1',
        owners: ['owner@example.com'],
        editors: ['editor@example.com'],
        modifiedTime: '2026-01-01T00:00:00.000Z',
        driveId: null,
        webViewLink: 'https://example.com/script-1',
        discoveredViaUser: 'user@example.com',
      },
    ] satisfies DriveScriptFile[]);

    const bundle = await client.getProjectBundle('user@example.com', scripts[0]!);
    expect(bundle.scriptId).toBe('script-1');
    expect(accessTokenCalls).toEqual([
      {
        subject: 'admin@example.com',
        scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
      },
      {
        subject: 'user@example.com',
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      },
      {
        subject: 'user@example.com',
        scopes: ['https://www.googleapis.com/auth/script.projects.readonly'],
      },
    ]);
  });
});
