import { query, batch, client, prepareStatement } from './turso-db.mjs';

export const pool = {
  query,
  async connect() {
    const tx = await client.transaction('write');
    return {
      query: async (sql, args = []) => {
        const control = String(sql).trim().toUpperCase();
        if (control === 'BEGIN') return { rows: [], rowCount: 0 };
        if (control === 'COMMIT') { await tx.commit(); return { rows: [], rowCount: 0 }; }
        if (control === 'ROLLBACK') { await tx.rollback(); return { rows: [], rowCount: 0 }; }
        const result = await tx.execute(prepareStatement(sql, args));
        return { rows: result.rows, rowCount: result.rowsAffected };
      },
      async release() { await tx.close(); },
      async commit() { await tx.commit(); },
      async rollback() { await tx.rollback(); },
    };
  },
};
export { query, batch, client };
export function resolveDatabaseUrl() { return process.env.TURSO_DATABASE_URL; }
