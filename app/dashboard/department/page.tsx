

import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import Link from 'next/link'
import DashboardControls from './controls'

export default async function DepartmentDashboard({ searchParams }: { searchParams: Promise<{ status?: string, sort?: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null
    const resolvedParams = await searchParams

    if (!user || (user.role !== 'DEPT_OFFICER' && user.role !== 'ADMIN')) {
        return <div>Unauthorized</div>
    }

    const conditions: string[] = []
    const values: unknown[] = []
    if (user.role === 'DEPT_OFFICER') {
        values.push(user.departmentId)
        conditions.push(`c."assignedDeptId" = $${values.length}`)
    }
    if (resolvedParams.status) {
        values.push(resolvedParams.status)
        conditions.push(`c.status = $${values.length}`)
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const ownDepartmentName = user.departmentId
        ? (await query('SELECT "categoryLabel", name FROM "Department" WHERE id = $1', [user.departmentId])).rows[0]
        : null

    const orderBySql = resolvedParams.sort === 'oldest'
        ? `c."createdAt" ASC`
        : resolvedParams.sort === 'newest'
            ? `c."createdAt" DESC`
            : `CASE c.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END ASC, c."createdAt" ASC`

    const { rows: complaintRows } = await query(
        `SELECT c.*, cu.name AS "complainantName", d."slaHours" AS "deptSlaHours"
         FROM "Complaint" c
         JOIN "User" cu ON cu.id = c."complainantId"
         LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
         ${whereSql}
         ORDER BY ${orderBySql}`,
        values
    )
    const complaints = complaintRows.map((c: any) => ({
        ...c,
        complainant: { name: c.complainantName },
        isOverdue: c.deptSlaHours != null
            && !['RESOLVED', 'CLOSED', 'REJECTED'].includes(c.status)
            && (Date.now() - new Date(c.createdAt).getTime()) > c.deptSlaHours * 60 * 60 * 1000,
    }))

    // Calculate stats
    const total = complaints.length
    const pending = complaints.filter(c => c.status === 'SUBMITTED').length
    const inProgress = complaints.filter(c => c.status === 'IN_PROGRESS').length
    const resolved = complaints.filter(c => c.status === 'RESOLVED').length

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Department Queue</h1>
                    <p className="text-muted">Manage and resolve complaints assigned to your department.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>Current Department</div>
                    <div style={{ fontWeight: '600' }}>{ownDepartmentName ? (ownDepartmentName.categoryLabel || ownDepartmentName.name) : 'All Departments'}</div>
                </div>
            </div>

            <div className="card" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
                <MiniStat label="Total" value={total} />
                <MiniStat label="Pending" value={pending} color="#3b82f6" />
                <MiniStat label="In Progress" value={inProgress} color="#eab308" />
                <MiniStat label="Resolved" value={resolved} color="#22c55e" />
            </div>

            <DashboardControls />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {complaints.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                        <p>No complaints found matching your criteria.</p>
                    </div>
                ) : (
                    complaints.map((complaint) => {
                        const daysOpen = Math.floor((new Date().getTime() - new Date(complaint.createdAt).getTime()) / (1000 * 3600 * 24))
                        return (
                            <Link href={`/dashboard/complaints/${complaint.id}`} key={complaint.id} style={{ textDecoration: 'none' }}>
                                <div className="card" style={{
                                    transition: 'all 0.2s',
                                    cursor: 'pointer',
                                    borderLeft: `4px solid ${getStatusColor(complaint.status)}`,
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: '1rem'
                                }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: 0,
                                                backgroundColor: 'var(--secondary)',
                                                color: 'var(--muted-foreground)',
                                                border: '1px solid var(--border)'
                                            }}>
                                                {complaint.category}
                                            </span>
                                            <h3 style={{ fontWeight: '600', fontSize: '1.125rem' }}>{complaint.title}</h3>
                                        </div>

                                        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem', display: 'flex', gap: '1rem' }}>
                                            <span>From: <span style={{ color: 'var(--foreground)' }}>{complaint.complainant.name}</span></span>
                                            <span>•</span>
                                            <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span>Open for {daysOpen} days</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                            {complaint.isOverdue && (
                                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: 0, fontSize: '0.7rem', fontWeight: '700', backgroundColor: '#ef4444', color: 'white' }}>
                                                    OVERDUE
                                                </span>
                                            )}
                                            <span style={{ padding: '0.25rem 0.75rem', borderRadius: 0, fontSize: '0.7rem', fontWeight: '600', backgroundColor: getPriorityColor(complaint.priority), color: 'white' }}>
                                                {complaint.priority}
                                            </span>
                                        </div>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: 0,
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: getStatusColor(complaint.status),
                                            color: 'white'
                                        }}>
                                            {complaint.status.replace('_', ' ')}
                                        </span>
                                        {complaint.assignedOfficerId ? (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Claimed by you</span>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: '#eab308', fontWeight: '500' }}>Unclaimed</span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                )}
            </div>
        </div>
    )
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
    return (
        <div>
            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: color || undefined }}>{value}</div>
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
