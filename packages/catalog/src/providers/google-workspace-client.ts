import {
  GOOGLE_SCOPES_DIRECTORY,
  GOOGLE_SCOPES_DRIVE,
  GOOGLE_SCOPES_SCRIPT,
  type DriveScriptFile,
  type ProjectBundle,
  type ScriptDeployment,
  type ScriptFile,
  type ScriptProjectContent,
  type ScriptProjectMetadata,
  type ScriptVersion,
  type WorkspaceDelegatedAuthConfig,
  type WorkspaceDelegatedAuthProvider,
} from '@google-app-script-inventory/common';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

export interface WorkspaceApiFactory {
  createAdmin(auth: OAuth2Client): {
    users: {
      list(params: {
        customer: string;
        maxResults: number;
        orderBy: string;
        pageToken?: string;
      }): Promise<{
        data: {
          users?: Array<{ primaryEmail?: string | null; suspended?: boolean | null }>;
          nextPageToken?: string | null;
        };
      }>;
    };
  };
  createDrive(auth: OAuth2Client): {
    files: {
      list(params: {
        q: string;
        fields: string;
        pageSize: number;
        includeItemsFromAllDrives: boolean;
        supportsAllDrives: boolean;
        pageToken?: string;
      }): Promise<{
        data: {
          files?: Array<{
            id?: string | null;
            name?: string | null;
            owners?: Array<{ emailAddress?: string | null }> | null;
            permissions?: Array<{ emailAddress?: string | null; role?: string | null }> | null;
            modifiedTime?: string | null;
            driveId?: string | null;
            webViewLink?: string | null;
          }>;
          nextPageToken?: string | null;
        };
      }>;
    };
  };
  createScript(auth: OAuth2Client): {
    projects: {
      get(params: { scriptId: string }): Promise<{
        data: {
          title?: string | null;
          createTime?: string | null;
          updateTime?: string | null;
          parentId?: string | null;
        };
      }>;
      getContent(params: { scriptId: string }): Promise<{
        data: {
          files?: Array<{ name?: string | null; type?: string | null; source?: string | null }>;
        };
      }>;
      deployments: {
        list(params: { scriptId: string }): Promise<{
          data: {
            deployments?: Array<{
              deploymentId?: string | null;
              entryPoints?: Array<{ entryPointType?: string | null }> | null;
            }>;
          };
        }>;
      };
      versions: {
        list(params: { scriptId: string }): Promise<{
          data: {
            versions?: Array<{
              versionNumber?: number | null;
              description?: string | null;
              createTime?: string | null;
            }>;
          };
        }>;
      };
    };
  };
}

export class GoogleWorkspaceClient {
  constructor(
    private readonly authProvider: WorkspaceDelegatedAuthProvider,
    private readonly apiFactory: WorkspaceApiFactory = {
      createAdmin: (auth) => google.admin({ version: 'directory_v1', auth }),
      createDrive: (auth) => google.drive({ version: 'v3', auth }),
      createScript: (auth) => google.script({ version: 'v1', auth }),
    },
  ) {}

  private async authForSubject(subject: string, scopes: string[]) {
    const token = await this.authProvider.getAccessToken(subject, scopes);
    const auth = new OAuth2Client();
    auth.setCredentials({
      access_token: token.accessToken,
      expiry_date: token.expiryDate ?? undefined,
    });
    return auth;
  }

  async listActiveUsers(config: WorkspaceDelegatedAuthConfig): Promise<string[]> {
    const auth = await this.authForSubject(config.adminSubject, [...GOOGLE_SCOPES_DIRECTORY]);
    const admin = this.apiFactory.createAdmin(auth);
    const users: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await admin.users.list({
        customer: 'my_customer',
        maxResults: 500,
        orderBy: 'email',
        pageToken,
      });
      for (const user of response.data.users ?? []) {
        if (!user.suspended && user.primaryEmail) {
          users.push(user.primaryEmail);
        }
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return users.sort((a, b) => a.localeCompare(b));
  }

  async listStandaloneScriptsForUser(userEmail: string): Promise<DriveScriptFile[]> {
    const auth = await this.authForSubject(userEmail, [...GOOGLE_SCOPES_DRIVE]);
    const drive = this.apiFactory.createDrive(auth);
    const files: DriveScriptFile[] = [];
    let pageToken: string | undefined;

    do {
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.script' and trashed=false",
        fields:
          'nextPageToken, files(id,name,owners(emailAddress),permissions(emailAddress,role),modifiedTime,driveId,webViewLink)',
        pageSize: 1000,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageToken,
      });

      for (const file of response.data.files ?? []) {
        const editors =
          file.permissions
            ?.filter((permission) => permission.role === 'writer' && permission.emailAddress)
            .map((permission) => permission.emailAddress as string) ?? [];
        files.push({
          scriptId: String(file.id),
          name: String(file.name ?? file.id),
          owners: (file.owners ?? []).map((owner) => String(owner.emailAddress)).filter(Boolean),
          editors,
          modifiedTime: file.modifiedTime ?? null,
          driveId: file.driveId ?? null,
          webViewLink: file.webViewLink ?? null,
          discoveredViaUser: userEmail,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    return files;
  }

  async getProjectBundle(userEmail: string, driveFile: DriveScriptFile): Promise<ProjectBundle> {
    const auth = await this.authForSubject(userEmail, [...GOOGLE_SCOPES_SCRIPT]);
    const script = this.apiFactory.createScript(auth);
    const [projectResponse, contentResponse, deploymentsResponse, versionsResponse] =
      await Promise.all([
        script.projects.get({ scriptId: driveFile.scriptId }),
        script.projects.getContent({ scriptId: driveFile.scriptId }),
        script.projects.deployments.list({ scriptId: driveFile.scriptId }),
        script.projects.versions.list({ scriptId: driveFile.scriptId }),
      ]);

    const files: ScriptFile[] =
      contentResponse.data.files?.map((file) => ({
        name: String(file.name),
        type: String(file.type),
        source: String(file.source ?? ''),
      })) ?? [];

    const content: ScriptProjectContent = {
      scriptId: driveFile.scriptId,
      files,
    };

    const project: ScriptProjectMetadata = {
      scriptId: driveFile.scriptId,
      title: String(projectResponse.data.title ?? driveFile.name),
      createTime: projectResponse.data.createTime ?? undefined,
      updateTime: projectResponse.data.updateTime ?? undefined,
      parentId: projectResponse.data.parentId ?? undefined,
    };

    const deployments: ScriptDeployment[] =
      deploymentsResponse.data.deployments?.map((deployment) => ({
        deploymentId: String(deployment.deploymentId),
        entryPoints:
          deployment.entryPoints?.map((entryPoint) => ({
            entryPointType: entryPoint.entryPointType ?? undefined,
          })) ?? [],
      })) ?? [];

    const versions: ScriptVersion[] =
      versionsResponse.data.versions?.map((version) => ({
        versionNumber: Number(version.versionNumber),
        description: version.description ?? undefined,
        createTime: version.createTime ?? undefined,
      })) ?? [];

    return {
      scriptId: driveFile.scriptId,
      title: project.title,
      driveFile,
      project,
      content,
      deployments,
      versions,
    };
  }
}
