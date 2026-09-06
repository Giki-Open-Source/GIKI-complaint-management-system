import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { buildCsv, buildPdf, exportFilename, type ExportColumn } from '@/lib/export'

type Row = {
    id: string
    name: string
    email: string
    phone: string | null
    isActive: boolean
    emailVerified: string | null
    deptName: string | null
    totalAssigned: number
    openNow: number
    overdueNow: number
    resolvedByThem: number
    avgRating: string | null
}

const COLUMNS: ExportColumn<Row>[] = [
    { header: 'Supervisor', width: 14, value: r => r.name },
    { header: 'Email', width: 20, value: r => r.email },
    { header: 'Phone', width: 10, value: r => r.phone || '-' },
    { header: 'Hostel / Department', width: 15, value: r => r.deptName || 'Unassigned' },
    { header: 'Account', width: 8, value: r => (r.isActive ? 'Active' : 'Suspended') },
    { header: 'Verified', width: 7, value: r => (r.emailVerified ? 'Yes' : 'No') },
    { header: 'Assigned', width: 7, value: r => String(r.totalAssigned) },
    { header: 'Open', width: 5, value: r => String(r.openNow) },
    { header: 'Overdue', width: 7, value: r => String(r.overdueNow) },
    { header: 'Resolved', width: 7, value: r => String(r.resolvedByThem) },
    { header: 'Avg Rating', width: 8, value: r => (r.avgRating ? String(r.avgRating) : '-') },
]

export async function GET(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'
    const search = url.searchParams.get('q')?.trim() || ''
    const dept = url.searchParams.get('dept') || ''

    // Mirrors the client-side search/department filters on the Supervisors page.
    const conditions: string[] = [`u.role = 'DEPT_OFFICER'`]
    const values: unknown[] = []

    if (search) {
        values.push(`%${search}%`)
        conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`)
    }
    if (dept) {
        values.push(dept)
        conditions.push(`u."departmentId" = $${values.length}`)
    }

    const { rows } = await query<Row>(
        `SELECT
            u.id, u.name, u.email, u.phone, u."isActive", u."emailVerified",
            d.name AS "deptName",
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
         WHERE ${conditions.join(' AND ')}
         ORDER BY d.name ASC NULLS LAST, u.name ASC`,
        values
    )

    if (format === 'csv') {
        const csv = buildCsv(rows, COLUMNS)
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportFilename('supervisors', 'csv')}"`,
            },
        })
    }

    const filterParts: string[] = []
    if (search) filterParts.push(`Search: ${search}`)
    if (dept) {
        const { rows: deptRows } = await query('SELECT name FROM "Department" WHERE id = $1', [dept])
        filterParts.push(`Hostel / Department: ${deptRows[0]?.name ?? dept}`)
    }

    const pdf = await buildPdf(rows, COLUMNS, {
        title: 'Supervisor Register',
        moduleCode: 'HMS-SUPERVISORS-01',
        filters: filterParts.length ? filterParts : ['None (all supervisors)'],
        generatedBy: user.name || user.email,
        totalRecords: rows.length,
    })

    return new NextResponse(new Uint8Array(pdf), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${exportFilename('supervisors', 'pdf')}"`,
        },
    })
}
