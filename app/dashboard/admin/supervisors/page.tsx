import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import SupervisorManagement from './supervisor-management'

export default async function SupervisorsPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    const [{ rows: supervisors }, { rows: departments }] = await Promise.all([
        query(
            `SELECT
                u.id, u.name, u.email, u.phone, u."isActive", u."emailVerified", u."createdAt",
                d.id AS "deptId", d.name AS "deptName",
                COALESCE(total.count, 0) AS "totalAssigned",
                COALESCE(open.count, 0) AS "openNow",
                COALESCE(overdue.count, 0) AS "overdueNow",
                COALESCE(resolved.count, 0) AS "resolvedByThem",
                rating.avg AS "avgRating"
             FROM "User" u
             LEFT JOIN "Department" d ON d.id = u."departmentId"
             LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS count FROM "Complaint" c WHERE c."assignedDeptId" = u."departmentId"
             ) total ON true
             LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS count FROM "Complaint" c
                WHERE c."assignedDeptId" = u."departmentId" AND c.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
             ) open ON true
             LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS count FROM "Complaint" c
                WHERE c."assignedDeptId" = u."departmentId"
                  AND c.status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
                  AND d."slaHours" IS NOT NULL
                  AND now() - c."createdAt" > (d."slaHours" || ' hours')::interval
             ) overdue ON true
             LEFT JOIN LATERAL (
                SELECT COUNT(*)::int AS count FROM "Complaint" c
                WHERE c."assignedOfficerId" = u.id AND c.status IN ('RESOLVED', 'CLOSED')
             ) resolved ON true
             LEFT JOIN LATERAL (
                SELECT ROUND(AVG(rating)::numeric, 2) AS avg FROM "Complaint" c
                WHERE c."assignedOfficerId" = u.id AND c.rating IS NOT NULL
             ) rating ON true
             WHERE u.role = 'DEPT_OFFICER'
             ORDER BY d.name ASC NULLS LAST, u.name ASC`
        ),
        query('SELECT id, name, "isHostel" FROM "Department" ORDER BY name ASC'),
    ])

    return (
        <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Supervisors</h1>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
                Manage department / hostel supervisors, their assignments, and what they&apos;re allowed to do.
            </p>
            <SupervisorManagement initialSupervisors={supervisors as any} departments={departments as any} />
        </div>
    )
}
