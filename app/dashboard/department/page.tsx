

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
    const orderDirection = resolvedParams.sort === 'oldest' ? 'ASC' : 'DESC'

    const { rows: complaintRows } = await query(
        `SELECT c.*, cu.name AS "complainantName"
         FROM "Complaint" c
         JOIN "User" cu ON cu.id = c."complainantId"
         ${whereSql}
         ORDER BY c."createdAt" ${orderDirection}`,
        values
    )
    const complaints = complaintRows.map((c: any) => ({
        ...c,
        complainant: { name: c.complainantName },
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
                    <div style={{ fontWeight: '600' }}>{user.departmentId || 'All Departments'}</div>
                </div>
            </div>

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div className="text-muted text-sm">Total Complaints</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{total}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #3b82f6' }}>
                    <div className="text-muted text-sm">Pending</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{pending}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #eab308' }}>
                    <div className="text-muted text-sm">In Progress</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#eab308' }}>{inProgress}</div>
                </div>
                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #22c55e' }}>
                    <div className="text-muted text-sm">Resolved</div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e' }}>{resolved}</div>
                </div>
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
                                                borderRadius: '4px',
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
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '9999px',
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

            {/* Helping Logic / Tips Section */}
            <div style={{ marginTop: '3rem', padding: '1.5rem', backgroundColor: 'var(--secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    💡 Officer Guidelines
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    <div>
                        <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '0.25rem' }}>1. Claiming Complaints</strong>
                        <p>Always "Claim" a complaint before working on it to avoid duplicate efforts by other officers.</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '0.25rem' }}>2. Resolution</strong>
                        <p>Provide a clear and concise resolution summary. This is visible to the student.</p>
                    </div>
                    <div>
                        <strong style={{ color: 'var(--foreground)', display: 'block', marginBottom: '0.25rem' }}>3. Escalation</strong>
                        <p>Only escalate if the issue requires higher authority approval or resources beyond your department.</p>
                    </div>
                </div>
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
        default: return '#64748b';
    }
}
