import 'dotenv/config'
import { readFileSync } from 'fs'
import path from 'path'
import { Pool } from 'pg'

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const schema = readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf-8')

    console.log('Applying schema...')
    await pool.query(schema)
    console.log('Schema applied.')

    await pool.end()
}

main().catch((error) => {
    console.error('Failed to initialize database:', error)
    process.exit(1)
})
