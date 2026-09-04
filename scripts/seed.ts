import 'dotenv/config'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    console.log('Starting seed...')

    const departments = ['Computer Science', 'Electrical Engineering', 'Administration', 'Student Affairs', 'Maintenance']

    for (const dept of departments) {
        await pool.query(
            'INSERT INTO "Department" (id, name) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
            [randomUUID(), dept]
        )
    }
    console.log('Departments seeded.')

    const adminPassword = await bcrypt.hash('admin123', 10)
    await pool.query(
        `INSERT INTO "User" (id, email, name, password, role, "emailVerified")
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (email) DO UPDATE SET "emailVerified" = now()`,
        [randomUUID(), 'admin@giki.edu.pk', 'System Administrator', adminPassword, 'ADMIN']
    )
    console.log('Admin user seeded.')

    console.log('Seeding completed.')
    await pool.end()
}

main().catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
})
