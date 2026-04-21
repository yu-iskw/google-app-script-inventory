import type {
  WorkspaceAccessToken,
  WorkspaceDelegatedAuthProvider,
} from '@google-app-script-inventory/common';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';

const IAM_SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const TOKEN_LIFETIME_SECONDS = 3600;
const TOKEN_REFRESH_BUFFER_MS = 60_000;

export interface JwtSigner {
  sign(targetServiceAccount: string, payload: string): Promise<string>;
}

export interface TokenExchanger {
  exchange(signedJwt: string): Promise<WorkspaceAccessToken>;
}

export function buildDelegatedJwtPayload(
  targetServiceAccount: string,
  subject: string,
  scopes: string[],
  nowMs: number = Date.now(),
): string {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + TOKEN_LIFETIME_SECONDS;
  return JSON.stringify({
    iss: targetServiceAccount,
    sub: subject,
    scope: scopes.join(' '),
    aud: TOKEN_URL,
    iat,
    exp,
  });
}

export class IamJwtSigner implements JwtSigner {
  private readonly auth = new GoogleAuth({ scopes: IAM_SCOPES });

  async sign(targetServiceAccount: string, payload: string): Promise<string> {
    const iamcredentials = google.iamcredentials({ version: 'v1', auth: this.auth });
    const response = await iamcredentials.projects.serviceAccounts.signJwt({
      name: `projects/-/serviceAccounts/${targetServiceAccount}`,
      requestBody: { payload },
    });
    const signedJwt = response.data.signedJwt;
    if (!signedJwt) {
      throw new Error(`IAM Credentials signJwt returned no signed JWT for ${targetServiceAccount}`);
    }
    return signedJwt;
  }
}

export class OAuthTokenExchanger implements TokenExchanger {
  async exchange(signedJwt: string): Promise<WorkspaceAccessToken> {
    const body = new URLSearchParams({
      grant_type: TOKEN_GRANT_TYPE,
      assertion: signedJwt,
    });
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!response.ok) {
      throw new Error(`OAuth token exchange failed with status ${response.status}`);
    }
    const payload = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!payload.access_token) {
      throw new Error('OAuth token exchange returned no access_token');
    }
    return {
      accessToken: payload.access_token,
      expiryDate:
        typeof payload.expires_in === 'number' ? Date.now() + payload.expires_in * 1000 : null,
    };
  }
}

export class WorkspaceImpersonatedAuthProvider implements WorkspaceDelegatedAuthProvider {
  private readonly cache = new Map<string, WorkspaceAccessToken>();

  constructor(
    private readonly impersonatedServiceAccount: string,
    private readonly signer: JwtSigner = new IamJwtSigner(),
    private readonly exchanger: TokenExchanger = new OAuthTokenExchanger(),
  ) {}

  async getAccessToken(subject: string, scopes: string[]): Promise<WorkspaceAccessToken> {
    const normalizedScopes = [...new Set(scopes)].sort();
    const cacheKey = `${subject}::${normalizedScopes.join(' ')}`;
    const cached = this.cache.get(cacheKey);
    if (cached?.expiryDate && cached.expiryDate - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
      return cached;
    }

    const payload = buildDelegatedJwtPayload(
      this.impersonatedServiceAccount,
      subject,
      normalizedScopes,
    );
    const signedJwt = await this.signer.sign(this.impersonatedServiceAccount, payload);
    const token = await this.exchanger.exchange(signedJwt);
    this.cache.set(cacheKey, token);
    return token;
  }
}
