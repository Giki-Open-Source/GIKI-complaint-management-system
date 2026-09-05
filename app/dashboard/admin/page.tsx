import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import Link from 'next/link'
import ComplaintAssignment from './complaints/assignment-modal'

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ status?: string, category?: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    const { status, category } = await searchParams
    const conditions: string[] = []
    const values: unknown[] = []
    if (status) { values.push(status); conditions.push(`c.status = $${values.length}`) }
    if (category) { values.push(category); conditions.push(`c.category = $${values.length}`) }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows: complaintRows } = await query(
        `SELECT c.*, cu.name AS "complainantName", d.name AS "assignedDeptName", d."slaHours" AS "deptSlaHours"
         FROM "Complaint" c
         JOIN "User" cu ON cu.id = c."complainantId"
         LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
         ${whereSql}
         ORDER BY c."createdAt" DESC`,
        values
    )
    const complaints = complaintRows.map((c: any) => ({
        ...c,
        complainant: { name: c.complainantName },
        assignedDept: c.assignedDeptName ? { name: c.assignedDeptName } : null,
        isOverdue: c.deptSlaHours != null
            && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status)
            && (Date.now() - new Date(c.createdAt).getTime()) > c.deptSlaHours * 60 * 60 * 1000,
    }))

    const { rows: departments } = await query('SELECT * FROM "Department"')
    const { rows: officers } = await query(
        `SELECT id, name, email, role, "departmentId" FROM "User" WHERE role = ANY($1)`,
        [['FACULTY', 'STAFF', 'DEPT_OFFICER']]
    )

    // Stats for quick view
    const { rows: totalRows } = await query('SELECT COUNT(*)::int AS count FROM "Complaint"')
    const { rows: resolvedRows } = await query(
        `SELECT COUNT(*)::int AS count FROM "Complaint" WHERE status = 'RESOLVED'`
    )
    const totalComplaints = totalRows[0].count
    const resolvedComplaints = resolvedRows[0].count
    const pendingComplaints = totalComplaints - resolvedComplaints

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Global Oversight Dashboard</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link href="/dashboard/admin/users" className="btn btn-outline">Manage Users</Link>
                    <Link href="/dashboard/admin/reports" className="btn btn-outline">Reports</Link>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Total Complaints</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalComplaints}</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Resolved</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{resolvedComplaints}</div>
                </div>
                <div className="card" style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Pending</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#eab308' }}>{pendingComplaints}</div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Filters</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <Link href="/dashboard/admin" className="btn btn-outline" style={{ opacity: !status ? 1 : 0.5 }}>All</Link>
                    <Link href="/dashboard/admin?status=SUBMITTED" className="btn btn-outline" style={{ opacity: status === 'SUBMITTED' ? 1 : 0.5 }}>Submitted</Link>
                    <Link href="/dashboard/admin?status=IN_PROGRESS" className="btn btn-outline" style={{ opacity: status === 'IN_PROGRESS' ? 1 : 0.5 }}>In Progress</Link>
                    <Link href="/dashboard/admin?status=ESCALATED" className="btn btn-outline" style={{ opacity: status === 'ESCALATED' ? 1 : 0.5 }}>Escalated</Link>
                    <Link href="/dashboard/admin?status=RESOLVED" className="btn btn-outline" style={{ opacity: status === 'RESOLVED' ? 1 : 0.5 }}>Resolved</Link>
                    <Link href="/dashboard/admin?status=CLOSED" className="btn btn-outline" style={{ opacity: status === 'CLOSED' ? 1 : 0.5 }}>Closed</Link>
                    <Link href="/dashboard/admin?status=REJECTED" className="btn btn-outline" style={{ opacity: status === 'REJECTED' ? 1 : 0.5 }}>Rejected</Link>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {complaints.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>
                        No complaints found.
                    </div>
                ) : (
                    complaints.map((complaint) => (
                        <Link href={`/dashboard/complaints/${complaint.id}`} key={complaint.id} style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ transition: 'transform 0.2s', cursor: 'pointer', borderLeft: `4px solid ${getStatusColor(complaint.status)}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontWeight: '600', fontSize: '1.125rem' }}>{complaint.title}</h3>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                        {new Date(complaint.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>
                                    From: {complaint.complainant.name} • Dept: {complaint.assignedDept?.name || 'Unassigned'}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        {complaint.isOverdue && (
                                            <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#ef4444', color: 'white' }}>
                                                OVERDUE
                                            </span>
                                        )}
                                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', backgroundColor: getPriorityColor(complaint.priority), color: 'white' }}>
                                            {complaint.priority}
                                        </span>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: getStatusColor(complaint.status),
                                            color: 'white'
                                        }}>
                                            {complaint.status}
                                        </span>
                                        <ComplaintAssignment
                                            complaintId={complaint.id}
                                            departments={departments}
                                            officers={officers}
                                            currentDeptId={complaint.assignedDeptId}
                                            currentOfficerId={complaint.assignedOfficerId}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}

function getStatusColor(status: string) {
    switch (status) {
        case 'SUBMITTED': return '#3b82f6';
        case 'IN_PROGRESS': return '#eab308';
        case 'ESCALATED': return '#ef4444';
        case 'RESOLVED': return '#22c55e';
        case 'CLOSED': return '#8b5cf6';
        case 'REJECTED': return '#64748b';
        default: return '#64748b';
    }
}

function getPriorityColor(priority: string) {
    switch (priority) {
        case 'CRITICAL': return '#dc2626';
        case 'HIGH': return '#ea580c';
        case 'MEDIUM': return '#ca8a04';
        case 'LOW': return '#16a34a';
        default: return '#64748b';
    }
}
