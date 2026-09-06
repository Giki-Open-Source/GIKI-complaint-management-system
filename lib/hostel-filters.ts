import { query } from './db'

export type HostelComplaintFilters = {
    hostel?: string
    supervisor?: string
    status?: string
    workType?: string
    regNo?: string
    q?: string
    from?: string
    to?: string
}

export const WORK_TYPES = [
    'Plumbing',
    'Electrical',
    'Carpentry',
    'HVAC / AC',
    'Internet / Wi-Fi',
    'Furniture',
    'Housekeeping',
    'Civil / Structural',
    'Pest Control',
]

/**
 * Builds the WHERE clause for the Hostel Complaints ledger. Shared by the page
 * and the export routes so an export always matches exactly what is on screen.
 */
export async function buildHostelComplaintWhere(sp: HostelComplaintFilters) {
    // Always scoped to hostel departments -- this is the Hostel Complaints module.
    const conditions: string[] = [`d."isHostel" = true`]
    const values: unknown[] = []

    if (sp.hostel) {
        values.push(sp.hostel)
        conditions.push(`d.id = $${values.length}`)
    }

    if (sp.supervisor) {
        const { rows } = await query('SELECT "departmentId" FROM "User" WHERE id = $1 AND role = $2', [sp.supervisor, 'DEPT_OFFICER'])
        if (rows[0]?.departmentId) {
            values.push(rows[0].departmentId)
            conditions.push(`d.id = $${values.length}`)
        } else {
            // Supervisor not found / not tied to a hostel -- force an empty result
            // rather than silently ignoring the filter.
            conditions.push('1 = 0')
        }
    }

    if (sp.status) {
        values.push(sp.status)
        conditions.push(`c.status = $${values.length}`)
    }

    if (sp.workType) {
        values.push(`%${sp.workType}%`)
        conditions.push(`(c.subcategory ILIKE $${values.length} OR c.category ILIKE $${values.length})`)
    }

    if (sp.regNo) {
        values.push(`%${sp.regNo}%`)
        conditions.push(`u."registrationNumber" ILIKE $${values.length}`)
    }

    if (sp.q) {
        values.push(`%${sp.q}%`)
        conditions.push(`(c.title ILIKE $${values.length} OR c.description ILIKE $${values.length} OR c.subcategory ILIKE $${values.length})`)
    }

    if (sp.from) {
        values.push(sp.from)
        conditions.push(`c."createdAt" >= $${values.length}::date`)
    }

    if (sp.to) {
        values.push(sp.to)
        conditions.push(`c."createdAt" < ($${values.length}::date + interval '1 day')`)
    }

    return { whereSql: `WHERE ${conditions.join(' AND ')}`, values }
}

/** Columns selected for both the on-screen ledger and its exports. */
export const HOSTEL_COMPLAINT_SELECT = `
    c.id,
    c.title,
    c.subcategory,
    c.category,
    c.status,
    c.priority,
    c."createdAt",
    u.name AS "studentName",
    u."registrationNumber",
    u."roomNumber",
    d.id AS "hostelId",
    d.name AS "hostelName",
    (SELECT string_agg(o.name, ', ' ORDER BY o.name)
     FROM "User" o
     WHERE o."departmentId" = d.id AND o.role = 'DEPT_OFFICER') AS "supervisorNames"
`

export const HOSTEL_COMPLAINT_FROM = `
    FROM "Complaint" c
    JOIN "User" u ON u.id = c."complainantId"
    JOIN "Department" d ON d.id = c."assignedDeptId"
`

/** Human-readable summary of the active filters, printed on the PDF header. */
export async function describeHostelFilters(sp: HostelComplaintFilters): Promise<string[]> {
    const parts: string[] = []

    if (sp.hostel) {
        const { rows } = await query('SELECT name FROM "Department" WHERE id = $1', [sp.hostel])
        parts.push(`Hostel: ${rows[0]?.name ?? sp.hostel}`)
    }
    if (sp.supervisor) {
        const { rows } = await query('SELECT name FROM "User" WHERE id = $1', [sp.supervisor])
        parts.push(`Supervisor: ${rows[0]?.name ?? sp.supervisor}`)
    }
    if (sp.status) parts.push(`Status: ${sp.status.replace('_', ' ')}`)
    if (sp.workType) parts.push(`Type of Work: ${sp.workType}`)
    if (sp.regNo) parts.push(`Reg. No.: ${sp.regNo}`)
    if (sp.q) parts.push(`Keyword: ${sp.q}`)
    if (sp.from) parts.push(`From: ${sp.from}`)
    if (sp.to) parts.push(`To: ${sp.to}`)

    return parts.length ? parts : ['None (all hostel complaints)']
}
