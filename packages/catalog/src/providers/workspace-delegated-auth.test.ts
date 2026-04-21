import { describe, expect, it, vi } from 'vitest';

import {
  buildDelegatedJwtPayload,
  type JwtSigner,
  type TokenExchanger,
  WorkspaceImpersonatedAuthProvider,
} from './workspace-delegated-auth';

describe('workspace delegated auth', () => {
  it('builds delegated JWT claims correctly', () => {
    const payload = JSON.parse(
      buildDelegatedJwtPayload(
        'dwd@example-project.iam.gserviceaccount.com',
        'user@example.com',
        ['scope-b', 'scope-a'],
        1_700_000_000_000,
      ),
    ) as Record<string, string | number>;

    expect(payload).toMatchObject({
      iss: 'dwd@example-project.iam.gserviceaccount.com',
      sub: 'user@example.com',
      scope: 'scope-b scope-a',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1700000000,
      exp: 1700003600,
    });
  });

  it('uses signJwt and caches exchanged tokens', async () => {
    const sign = vi.fn<JwtSigner['sign']>().mockResolvedValue('signed-jwt');
    const exchange = vi.fn<TokenExchanger['exchange']>().mockResolvedValue({
      accessToken: 'token-1',
      expiryDate: Date.now() + 30 * 60 * 1000,
    });
    const provider = new WorkspaceImpersonatedAuthProvider(
      'dwd@example-project.iam.gserviceaccount.com',
      { sign },
      { exchange },
    );

    const first = await provider.getAccessToken('user@example.com', [
      'scope-b',
      'scope-a',
      'scope-b',
    ]);
    const second = await provider.getAccessToken('user@example.com', ['scope-a', 'scope-b']);

    expect(first.accessToken).toBe('token-1');
    expect(second.accessToken).toBe('token-1');
    expect(sign).toHaveBeenCalledTimes(1);
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(sign.mock.calls[0]?.[0]).toBe('dwd@example-project.iam.gserviceaccount.com');
    expect(JSON.parse(sign.mock.calls[0]?.[1] as string)).toMatchObject({
      iss: 'dwd@example-project.iam.gserviceaccount.com',
      sub: 'user@example.com',
      scope: 'scope-a scope-b',
    });
  });
});
