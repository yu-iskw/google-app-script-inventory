import { describe, expect, it } from 'vitest';

import { buildProgram } from './program';

describe('program', () => {
  it('renders help with expected commands', () => {
    const help = buildProgram().helpInformation();
    expect(help).toContain('scan');
    expect(help).toContain('export');
    expect(help).toContain('db');
    expect(help).toContain('ai');
    expect(help).not.toContain('service-account-key-file');
  });

  it('documents impersonation on scan full help', () => {
    const scan = buildProgram().commands.find((command) => command.name() === 'scan');
    const fullHelp =
      scan?.commands.find((command) => command.name() === 'full')?.helpInformation() ?? '';
    expect(fullHelp).toContain('--impersonate-service-account');
  });

  it('rejects missing impersonation option for scan full', async () => {
    const program = buildProgram();
    program.configureOutput({
      writeErr: () => undefined,
      outputError: () => undefined,
    });
    program.exitOverride((error) => {
      throw error;
    });
    await expect(
      program.parseAsync([
        'node',
        'catalog',
        'scan',
        'full',
        '--admin-subject',
        'admin@example.com',
      ]),
    ).rejects.toThrow(/process\.exit unexpectedly called with "1"/);
  });
});
