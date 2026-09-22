import { readFile } from 'node:fs/promises';
import { client } from '../netlify/functions/lib/turso-db.mjs';

export function splitSql(input) {
  const withoutLineComments = value => value
    .split(/\r?\n/)
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = [];
  let start = 0;
  let quote = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote && input[i + 1] === quote) { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '-' && input[i + 1] === '-') {
      const newline = input.indexOf('\n', i + 2);
      i = newline === -1 ? input.length : newline;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === ';') {
      const statement = withoutLineComments(input.slice(start, i)).trim();
      // SQLite trigger bodies contain their own semicolon-separated SQL.
      // Keep reading until the trigger's closing `END;` rather than treating
      // the first body statement as the end of the CREATE TRIGGER statement.
      if (/^CREATE\s+TRIGGER\b/i.test(statement) && !/\bEND\s*$/i.test(statement)) continue;
      if (statement) statements.push(statement);
      start = i + 1;
    }
  }
  const tail = withoutLineComments(input.slice(start)).trim();
  if (tail) statements.push(tail);
  return statements;
}

export async function runSqlFile(file, transform = value => value) {
  const sql = transform(await readFile(file, 'utf8'));
  for (const statement of splitSql(sql)) await client.execute(statement);
}

export function convertStaticMigration(sql) {
  return sql
    .replaceAll('::jsonb', '')
    .replaceAll('::numeric', '')
    .replaceAll('INSERT INTO', 'INSERT OR IGNORE INTO')
    .replace(/\nON CONFLICT[\s\S]*?;\n/g, '\n;\n');
}
