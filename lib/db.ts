import { Pool, QueryResultRow } from 'pg'

const globalForPg = globalThis as unknown as {
  pool: Pool | undefined
}

export const pool = globalForPg.pool ?? new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') globalForPg.pool = pool

export function query<T extends QueryResultRow = any>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params)
}
