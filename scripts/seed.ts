import 'dotenv/config'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const OLD_DEPARTMENT_NAMES = ['Computer Science', 'Electrical Engineering', 'Administration', 'Student Affairs', 'Maintenance']

const DEPARTMENTS = [
    { name: 'Hostel Maintenance', categoryLabel: 'Hostel Maintenance', defaultPriority: 'MEDIUM', slaHours: 48, escalationContactName: 'Chief Warden', escalationContactTitle: 'Chief Warden' },
    { name: 'Mess & Dining', categoryLabel: 'Mess & Dining', defaultPriority: 'HIGH', slaHours: 24, escalationContactName: 'Dean of Student Affairs', escalationContactTitle: 'Dean of Student Affairs' },
    { name: 'Campus IT & Wi-Fi', categoryLabel: 'Campus IT & Wi-Fi', defaultPriority: 'HIGH', slaHours: 24, escalationContactName: 'Director IT', escalationContactTitle: 'Director IT' },
    { name: 'Academic Facilities', categoryLabel: 'Academic Facilities', defaultPriority: 'MEDIUM', slaHours: 48, escalationContactName: 'Dean of Academics', escalationContactTitle: 'Dean of Academics' },
    { name: 'Campus Works & Utilities', categoryLabel: 'Campus Works & Utilities', defaultPriority: 'MEDIUM', slaHours: 72, escalationContactName: 'Director of Works & Services', escalationContactTitle: 'Director of Works & Services' },
    { name: 'Transport & Security', categoryLabel: 'Transport & Security', defaultPriority: 'MEDIUM', slaHours: 48, escalationContactName: 'Chief Security Officer', escalationContactTitle: 'Chief Security Officer' },
    { name: 'Fee & Accounts', categoryLabel: 'Fee & Accounts', defaultPriority: 'MEDIUM', slaHours: 72, escalationContactName: 'Treasurer / Registrar', escalationContactTitle: 'Treasurer / Registrar' },
]

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })

    console.log('Starting seed...')

    // Replacing the old generic 5-department taxonomy with the real 7-department
    // hierarchy. FK columns referencing these (User.departmentId, Complaint.assignedDeptId)
    // are ON DELETE SET NULL, so this is a safe cascade, not an error.
    await pool.query('DELETE FROM "Department" WHERE name = ANY($1)', [OLD_DEPARTMENT_NAMES])

    for (const dept of DEPARTMENTS) {
        await pool.query(
            `INSERT INTO "Department" (id, name, "categoryLabel", "defaultPriority", "slaHours", "escalationContactName", "escalationContactTitle")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (name) DO UPDATE SET
                "categoryLabel" = EXCLUDED."categoryLabel",
                "defaultPriority" = EXCLUDED."defaultPriority",
                "slaHours" = EXCLUDED."slaHours",
                "escalationContactName" = EXCLUDED."escalationContactName",
                "escalationContactTitle" = EXCLUDED."escalationContactTitle"`,
            [randomUUID(), dept.name, dept.categoryLabel, dept.defaultPriority, dept.slaHours, dept.escalationContactName, dept.escalationContactTitle]
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
