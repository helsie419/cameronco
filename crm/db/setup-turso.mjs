#!/usr/bin/env node
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { client } from '../netlify/functions/lib/turso-db.mjs';
import { runSqlFile, convertStaticMigration } from './turso-runner.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));

await runSqlFile(path.join(dir, 'schema.turso.sql'));
await runSqlFile(path.join(dir, 'seed.turso.sql'));
await runSqlFile(path.join(dir, 'migrations/002_static_values_from_workbooks.sql'), convertStaticMigration);
await client.close();
console.log('Turso schema, seed and workbook reference data applied.');
