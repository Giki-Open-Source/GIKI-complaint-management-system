import { cookies } from 'next/headers'
import Link from 'next/link'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { Status } from '@/lib/enums'
import styles from './hostels.module.css'

const WORK_TYPES = [
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

type SearchParams = {
    hostel?: string
    supervisor?: string
    status?: string
    workType?: string
    regNo?: string
    q?: string
    from?: string
    to?: string
    page?: string
    pageSize?: string
}

export default async function HostelComplaintsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    const sp = await searchParams

    const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize)) ? Number(sp.pageSize) : DEFAULT_PAGE_SIZE
    const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)

    // Always scoped to hostel departments -- this is the Hostel Complaints module.
    const conditions: string[] = [`d."isHostel" = true`]
    const values: unknown[] = []

    if (sp.hostel) {
        values.push(sp.hostel)
        conditions.push(`d.id = $${values.length}`)
    }

    if (sp.supervisor) {
        const { rows: officerRows } = await query('SELECT "departmentId" FROM "User" WHERE id = $1 AND role = $2', [sp.supervisor, 'DEPT_OFFICER'])
        if (officerRows[0]?.departmentId) {
            values.push(officerRows[0].departmentId)
            conditions.push(`d.id = $${values.length}`)
        } else {
            // Supervisor not found / not tied to a hostel -- force an empty result rather than ignoring the filter.
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

    const whereSql = `WHERE ${conditions.join(' AND ')}`

    const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count
         FROM "Complaint" c
         JOIN "User" u ON u.id = c."complainantId"
         JOIN "Department" d ON d.id = c."assignedDeptId"
         ${whereSql}`,
        values
    )
    const totalRecords = countRows[0].count as number
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const currentPage = Math.min(page, totalPages)
    const offset = (currentPage - 1) * pageSize

    const { rows: complaints } = await query(
        `SELECT
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
         FROM "Complaint" c
         JOIN "User" u ON u.id = c."complainantId"
         JOIN "Department" d ON d.id = c."assignedDeptId"
         ${whereSql}
         ORDER BY c."createdAt" DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, pageSize, offset]
    )

    const { rows: hostelOptions } = await query('SELECT id, name FROM "Department" WHERE "isHostel" = true ORDER BY name')
    const { rows: supervisorOptions } = await query(
        `SELECT u.id, u.name, d.name AS "deptName"
         FROM "User" u
         JOIN "Department" d ON d.id = u."departmentId"
         WHERE u.role = 'DEPT_OFFICER' AND d."isHostel" = true
         ORDER BY d.name, u.name`
    )

    // Build a query string that preserves every current filter, overriding only the given keys.
    const buildUrl = (overrides: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams()
        const merged = { ...sp, ...Object.fromEntries(Object.entries(overrides).map(([k, v]) => [k, v?.toString()])) }
        for (const [key, value] of Object.entries(merged)) {
            if (value) params.set(key, value as string)
        }
        return `/dashboard/admin/hostels?${params.toString()}`
    }

    const rangeStart = totalRecords === 0 ? 0 : offset + 1
    const rangeEnd = Math.min(offset + pageSize, totalRecords)

    return (
        <div className={styles.page}>
            <div className={styles.titleBar}>
                <span>HOSTEL COMPLAINTS &mdash; MAINTENANCE TICKET REGISTER</span>
                <span style={{ fontWeight: 'normal', fontSize: '11px', color: '#dce8f5' }}>Module: HMS-COMPLAINTS-01</span>
            </div>

            <div className={styles.panel}>
                <div className={styles.panelHeading}>Search Criteria</div>
                <form method="GET" action="/dashboard/admin/hostels">
                    <input type="hidden" name="page" value="1" />
                    <div className={styles.filterGrid}>
                        <div className={styles.filterField}>
                            <label htmlFor="hostel">Hostel</label>
                            <select id="hostel" name="hostel" defaultValue={sp.hostel || ''}>
                                <option value="">-- All Hostels --</option>
                                {hostelOptions.map((h: any) => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="supervisor">Supervisor</label>
                            <select id="supervisor" name="supervisor" defaultValue={sp.supervisor || ''}>
                                <option value="">-- All Supervisors --</option>
                                {supervisorOptions.map((o: any) => (
                                    <option key={o.id} value={o.id}>{o.name} ({o.deptName})</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="status">Status</label>
                            <select id="status" name="status" defaultValue={sp.status || ''}>
                                <option value="">-- All Status --</option>
                                {Object.values(Status).map((s) => (
                                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="workType">Type of Work</label>
                            <select id="workType" name="workType" defaultValue={sp.workType || ''}>
                                <option value="">-- All Types --</option>
                                {WORK_TYPES.map((w) => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="regNo">Reg. No.</label>
                            <input id="regNo" type="text" name="regNo" defaultValue={sp.regNo || ''} placeholder="e.g. 2021001" />
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="q">Keyword</label>
                            <input id="q" type="text" name="q" defaultValue={sp.q || ''} placeholder="Title / description" />
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="from">Date From</label>
                            <input id="from" type="date" name="from" defaultValue={sp.from || ''} />
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="to">Date To</label>
                            <input id="to" type="date" name="to" defaultValue={sp.to || ''} />
                        </div>

                        <div className={styles.filterField}>
                            <label htmlFor="pageSize">Rows Per Page</label>
                            <select id="pageSize" name="pageSize" defaultValue={pageSize}>
                                {PAGE_SIZE_OPTIONS.map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.toolbar}>
                        <span className={styles.recordCount}>{totalRecords} record(s) match current criteria</span>
                        <Link href="/dashboard/admin/hostels" className={styles.linkBtn}>Reset</Link>
                        <button type="submit" className={styles.btnErp}>Search</button>
                    </div>
                </form>
            </div>

            <div className={styles.tableWrap}>
                <table className={styles.grid}>
                    <thead>
                        <tr>
                            <th className={styles.rowNo}>#</th>
                            <th>Reg. No.</th>
                            <th>Student Name</th>
                            <th>Hostel</th>
                            <th>Room</th>
                            <th>Supervisor</th>
                            <th>Type of Work</th>
                            <th>Complaint Title</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Date Created</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {complaints.map((c: any, idx: number) => (
                            <tr key={c.id}>
                                <td className={styles.rowNo}>{offset + idx + 1}</td>
                                <td>{c.registrationNumber || '-'}</td>
                                <td>{c.studentName}</td>
                                <td>{c.hostelName}</td>
                                <td>{c.roomNumber || '-'}</td>
                                <td>{c.supervisorNames || 'Unassigned'}</td>
                                <td>{c.subcategory || c.category}</td>
                                <td>{c.title}</td>
                                <td>{c.priority}</td>
                                <td><span className={`${styles.statusBadge} ${styles[getStatusClass(c.status)]}`}>{c.status.replace('_', ' ')}</span></td>
                                <td>{formatDate(c.createdAt)}</td>
                                <td><Link href={`/dashboard/complaints/${c.id}`} className={styles.viewLink}>View</Link></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {complaints.length === 0 && (
                <div className={styles.noRecords}>No hostel complaints match the current search criteria.</div>
            )}

            <div className={styles.footerBar}>
                <span>Showing {rangeStart}-{rangeEnd} of {totalRecords} records &nbsp;|&nbsp; Page {currentPage} of {totalPages}</span>
                <span className={styles.pageLinks}>
                    {currentPage <= 1 ? <span className={styles.disabled}>&laquo; First</span> : <Link href={buildUrl({ page: 1 })}>&laquo; First</Link>}
                    {currentPage <= 1 ? <span className={styles.disabled}>&lsaquo; Prev</span> : <Link href={buildUrl({ page: currentPage - 1 })}>&lsaquo; Prev</Link>}
                    {getPageWindow(currentPage, totalPages).map((p) => (
                        p === currentPage
                            ? <span key={p} className={styles.current}>{p}</span>
                            : <Link key={p} href={buildUrl({ page: p })}>{p}</Link>
                    ))}
                    {currentPage >= totalPages ? <span className={styles.disabled}>Next &rsaquo;</span> : <Link href={buildUrl({ page: currentPage + 1 })}>Next &rsaquo;</Link>}
                    {currentPage >= totalPages ? <span className={styles.disabled}>Last &raquo;</span> : <Link href={buildUrl({ page: totalPages })}>Last &raquo;</Link>}
                </span>
            </div>
        </div>
    )
}

function getPageWindow(current: number, total: number, span = 2): number[] {
    const start = Math.max(1, current - span)
    const end = Math.min(total, current + span)
    const pages: number[] = []
    for (let p = start; p <= end; p++) pages.push(p)
    return pages
}

function formatDate(value: string) {
    const d = new Date(value)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${dd}-${mm}-${yyyy} ${hh}:${min}`
}

function getStatusClass(status: string) {
    switch (status) {
        case 'SUBMITTED': return 'statusSubmitted'
        case 'IN_PROGRESS': return 'statusInProgress'
        case 'ESCALATED': return 'statusEscalated'
        case 'RESOLVED': return 'statusResolved'
        case 'CLOSED': return 'statusClosed'
        case 'REJECTED': return 'statusRejected'
        default: return 'statusSubmitted'
    }
}
