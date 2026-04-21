import {
  type AiDoctorOptions,
  type AiEnrichPendingOptions,
  type ExportOptions,
  type GlobalCliOptions,
  type ScanFullOptions,
  DEFAULT_VERTEX_GEMINI_PROVIDER_ID,
  parseInteger,
} from '@google-app-script-inventory/common';
import { Command } from 'commander';

import { createApplication } from '../composition';

function normalizeGlobals(options: Record<string, unknown>): GlobalCliOptions {
  return {
    dbPath: String(options.dbPath ?? process.env.CATALOG_DB_PATH ?? './data/catalog.sqlite'),
    logLevel: (options.logLevel ?? 'info') as GlobalCliOptions['logLevel'],
  };
}

/** Root program options for nested `scan` / `export` / `db` / `ai` subcommands. */
function globalsFromNestedCommand(command: Command): GlobalCliOptions {
  return normalizeGlobals((command.parent?.parent?.opts() ?? {}) as Record<string, unknown>);
}

type CatalogApp = Awaited<ReturnType<typeof createApplication>>;

async function withCatalogApp(
  command: Command,
  run: (app: CatalogApp, globals: GlobalCliOptions) => Promise<void>,
): Promise<void> {
  const globals = globalsFromNestedCommand(command);
  const app = await createApplication(globals);
  await run(app, globals);
}

function requireString(value: unknown, name: string): string {
  if (typeof value === 'string' && value.length > 0) return value;
  throw new Error(`Missing required option: ${name}`);
}

function normalizeScanOptions(
  options: Record<string, unknown>,
  globals: GlobalCliOptions,
): ScanFullOptions {
  return {
    ...globals,
    adminSubject: requireString(options.adminSubject, 'adminSubject'),
    impersonatedServiceAccount: requireString(
      options.impersonateServiceAccount,
      'impersonateServiceAccount',
    ),
    aiMode: options.ai ? 'inline' : 'off',
  };
}

function normalizeExportOptions(
  options: Record<string, unknown>,
  globals: GlobalCliOptions,
): ExportOptions {
  return {
    ...globals,
    out: requireString(options.out, 'out'),
  };
}

function normalizeAiOptions(
  options: Record<string, unknown>,
  globals: GlobalCliOptions,
): AiEnrichPendingOptions {
  return {
    ...globals,
    provider: (options.provider ??
      DEFAULT_VERTEX_GEMINI_PROVIDER_ID) as AiEnrichPendingOptions['provider'],
    limit: typeof options.limit === 'number' ? options.limit : undefined,
  };
}

function normalizeAiDoctorOptions(
  options: Record<string, unknown>,
  globals: GlobalCliOptions,
): AiDoctorOptions {
  return {
    ...globals,
    provider: (options.provider ??
      DEFAULT_VERTEX_GEMINI_PROVIDER_ID) as AiDoctorOptions['provider'],
  };
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('catalog')
    .description('Google Apps Script standalone governance catalog')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .option(
      '--db-path <path>',
      'SQLite database path',
      process.env.CATALOG_DB_PATH ?? './data/catalog.sqlite',
    )
    .option('--log-level <level>', 'Log level', process.env.LOG_LEVEL ?? 'info');

  const scan = program.command('scan').description('Run catalog scans');
  scan
    .command('full')
    .description('Run a full standalone Apps Script discovery and enrichment scan')
    .requiredOption(
      '--admin-subject <email>',
      'Delegated admin subject',
      process.env.GOOGLE_ADMIN_SUBJECT,
    )
    .requiredOption(
      '--impersonate-service-account <email>',
      'Service account to impersonate for Workspace domain-wide delegation',
      process.env.GOOGLE_IMPERSONATE_SERVICE_ACCOUNT,
    )
    .option('--ai', 'Enable inline AI enrichment', false)
    .action(async (options, command) => {
      await withCatalogApp(command, async (app, globals) => {
        await app.scanFull(normalizeScanOptions(options as Record<string, unknown>, globals));
      });
    });

  const exportCommand = program.command('export').description('Export catalog snapshots');
  exportCommand
    .command('json')
    .description('Export latest snapshot as JSON')
    .requiredOption('--out <path>', 'Output path')
    .action(async (options, command) => {
      await withCatalogApp(command, async (app, globals) => {
        await app.exportJson(normalizeExportOptions(options as Record<string, unknown>, globals));
      });
    });
  exportCommand
    .command('csv')
    .description('Export latest snapshot as CSV')
    .requiredOption('--out <path>', 'Output path')
    .action(async (options, command) => {
      await withCatalogApp(command, async (app, globals) => {
        await app.exportCsv(normalizeExportOptions(options as Record<string, unknown>, globals));
      });
    });

  const db = program.command('db').description('Database maintenance');
  db.command('migrate')
    .description('Create or upgrade schema')
    .action(async (_, command) => {
      await withCatalogApp(command, async (app) => {
        await app.dbMigrate();
      });
    });
  db.command('doctor')
    .description('Validate database connectivity and schema')
    .action(async (_, command) => {
      await withCatalogApp(command, async (app) => {
        await app.dbDoctor();
      });
    });

  const ai = program.command('ai').description('Optional AI enrichment operations');
  ai.command('enrich-pending')
    .description('Enrich pending scripts using the configured AI provider')
    .option(
      '--provider <provider>',
      'AI provider to use',
      process.env.AI_PROVIDER ?? DEFAULT_VERTEX_GEMINI_PROVIDER_ID,
    )
    .option('--limit <n>', 'Maximum number of scripts to enrich', parseInteger)
    .action(async (options, command) => {
      await withCatalogApp(command, async (app, globals) => {
        await app.aiEnrichPending(normalizeAiOptions(options as Record<string, unknown>, globals));
      });
    });
  ai.command('doctor')
    .description('Validate optional AI provider configuration')
    .option(
      '--provider <provider>',
      'AI provider to validate',
      process.env.AI_PROVIDER ?? DEFAULT_VERTEX_GEMINI_PROVIDER_ID,
    )
    .action(async (options, command) => {
      await withCatalogApp(command, async (app, globals) => {
        await app.aiDoctor(normalizeAiDoctorOptions(options as Record<string, unknown>, globals));
      });
    });

  return program;
}
