/**
 * pd-db.ts — Read-only connection to the PromptDome (ingestshield) database.
 * Max Dashboard queries this for Shield page data instead of its local ShieldLog table.
 * The source of truth for all scan data is the PromptDome ShieldScan table.
 */
import { Pool } from 'pg'

const PD_DB_URL = 'postgresql://postgres:IttpQGczrT91qrdUEHENGsYvpnRIN6aa@127.0.0.1:5433/ingestshield'
// Max's PromptDome customer ID — scopes all queries to Max's account only
export const PD_CUSTOMER_ID = 'cust_max_openclaw'

const globalForPd = globalThis as unknown as { pdPool: Pool }

export const pdPool = globalForPd.pdPool ?? new Pool({ connectionString: PD_DB_URL, max: 5 })
if (process.env.NODE_ENV !== 'production') globalForPd.pdPool = pdPool

export async function pdQuery<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pdPool.query(sql, params)
  return rows as T[]
}
