import { cookies } from 'next/headers'
import Link from 'next/link'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { normalizePermissions } from '@/lib/permissions'
import SupervisorDetailActions from './supervisor-detail-actions'
import styles from './supervisor-detail.module.css'

export default async function SupervisorDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const admin = token ? await getUserFromToken(token) : null

    if (!admin || admin.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    const { id } = await params

    const { rows: supRows } = await query(
        `SELECT u.*, d.name AS "deptName", d."slaHours" AS "deptSlaHours"
         FROM "User" u
         LEFT JOIN "Department" d ON d.id = u."departmentId"
         WHERE u.id = $1 AND u.role = 'DEPT_OFFICER'`,
        [id]
    )
    const supervisor = supRows[0]

    if (!supervisor) {
        return <div>Supervisor not found</div>
    }

    const [
        { rows: deptTotals },
        { rows: actionCounts },
        { rows: resolutionStats },
        { rows: reopenRows },
        { rows: lastActiveRows },
        { rows: recentActivity },
        { rows: currentQueue },
        { rows: departments },
    ] = await Promise.all([
        query(
            `SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED'))::int AS open,
                COUNT(*) FILTER (
                    WHERE status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
                    AND $2::int IS NOT NULL AND now() - "createdAt" > ($2 || ' hours')::interval
                )::int AS overdue
             FROM "Complaint" WHERE "assignedDeptId" = $1`,
            [supervisor.departmentId, supervisor.deptSlaHours]
        ),
        query(`SELECT action, COUNT(*)::int AS count FROM "AuditLog" WHERE "actorId" = $1 GROUP BY action`, [id]),
        query(
            `SELECT
                COUNT(*)::int AS "totalResolved",
                ROUND(AVG(EXTRACT(EPOCH FROM (al."createdAt" - c."createdAt")) / 3600)::numeric, 1) AS "avgResolutionHours",
                COUNT(*) FILTER (
                    WHERE d."slaHours" IS NOT NULL AND al."createdAt" - c."createdAt" <= (d."slaHours" || ' hours')::interval
                )::int AS "withinSla"
             FROM "AuditLog" al
             JOIN "Complaint" c ON c.id = al."complaintId"
             LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
             WHERE al."actorId" = $1 AND al.action = 'STATUS_CHANGED_TO_RESOLVED'`,
            [id]
        ),
        query(
            `SELECT COUNT(DISTINCT reopen."complaintId")::int AS count
             FROM "AuditLog" reopen
             WHERE reopen.action = 'REOPENED' AND reopen."complaintId" IN (
                SELECT "complaintId" FROM "AuditLog" WHERE "actorId" = $1 AND action = 'STATUS_CHANGED_TO_RESOLVED'
             )`,
            [id]
        ),
        query(`SELECT MAX("createdAt") AS "lastActive" FROM "AuditLog" WHERE "actorId" = $1`, [id]),
        query(
            `SELECT al.*, c.title AS "complaintTitle"
             FROM "AuditLog" al
             JOIN "Complaint" c ON c.id = al."complaintId"
             WHERE al."actorId" = $1
             ORDER BY al."createdAt" DESC
             LIMIT 15`,
            [id]
        ),
        supervisor.departmentId
            ? query(
                `SELECT id, title, status, priority, "createdAt", "assignedOfficerId"
                 FROM "Complaint"
                 WHERE "assignedDeptId" = $1 AND status NOT IN ('RESOLVED', 'CLOSED', 'REJECTED')
                 ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, "createdAt" ASC
                 LIMIT 10`,
                [supervisor.departmentId]
            )
            : Promise.resolve({ rows: [] as any[] }),
        query('SELECT id, name, "isHostel" FROM "Department" ORDER BY name ASC'),
    ])

    const actionCountMap = Object.fromEntries(actionCounts.map((r: any) => [r.action, r.count]))
    const deptStats = deptTotals[0] || { total: 0, open: 0, overdue: 0 }
    const resolution = resolutionStats[0] || { totalResolved: 0, avgResolutionHours: null, withinSla: 0 }
    const reopens = reopenRows[0]?.count ?? 0
    const slaComplianceRate = resolution.totalResolved > 0
        ? Math.round((resolution.withinSla / resolution.totalResolved) * 100)
        : null
    const permissions = normalizePermissions(supervisor.permissions)
    const lastActive = lastActiveRows[0]?.lastActive as string | null

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/dashboard/admin/supervisors" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    ← Back to Supervisors
                </Link>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{supervisor.name}</h1>
                            <span style={{
                                padding: '0.125rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                backgroundColor: supervisor.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                color: supervisor.isActive ? '#22c55e' : '#ef4444',
                            }}>
                                {supervisor.isActive ? 'Active' : 'Suspended'}
                            </span>
                            {!supervisor.emailVerified && (
                                <span style={{ padding: '0.125rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                                    Not Verified
                                </span>
                            )}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>{supervisor.email}</span>
                            <span>{supervisor.phone || 'No phone on file'}</span>
                            <span>Joined {new Date(supervisor.createdAt).toLocaleDateString()}</span>
                            <span>{lastActive ? `Last active ${formatRelativeTime(lastActive)}` : 'No activity yet'}</span>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="text-muted text-sm">Assigned To</div>
                        <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{supervisor.deptName || 'Unassigned'}</div>
                    </div>
                </div>
            </div>

            <div className={styles.factGrid}>
                <div className="card">
                    <div className={styles.factHeading}>Department Queue</div>
                    <Fact label="Total in Queue" value={deptStats.total} />
                    <Fact label="Open Now" value={deptStats.open} />
                    <Fact label="Overdue Now" value={deptStats.overdue} color={deptStats.overdue > 0 ? '#ef4444' : undefined} />
                </div>

                <div className="card">
                    <div className={styles.factHeading}>Actions Performed</div>
                    <Fact label="Claims Made" value={actionCountMap['STATUS_CHANGED_TO_IN_PROGRESS'] || 0} />
                    <Fact label="Resolved" value={actionCountMap['STATUS_CHANGED_TO_RESOLVED'] || 0} color="#22c55e" />
                    <Fact label="Escalated" value={actionCountMap['STATUS_CHANGED_TO_ESCALATED'] || 0} />
                    <Fact label="Rejected" value={actionCountMap['STATUS_CHANGED_TO_REJECTED'] || 0} />
                    <Fact label="Rerouted" value={actionCountMap['REROUTED'] || 0} />
                </div>

                <div className="card">
                    <div className={styles.factHeading}>Quality &amp; SLA</div>
                    <Fact label="Avg Resolution Time" value={resolution.avgResolutionHours != null ? `${resolution.avgResolutionHours}h` : '—'} />
                    <Fact label="SLA Compliance" value={slaComplianceRate != null ? `${slaComplianceRate}%` : '—'} color={slaComplianceRate != null && slaComplianceRate < 70 ? '#ef4444' : undefined} />
                    <Fact label="Reopened by Complainant" value={reopens} color={reopens > 0 ? '#eab308' : undefined} />
                </div>
            </div>

            <SupervisorDetailActions
                supervisorId={supervisor.id}
                phone={supervisor.phone}
                departmentId={supervisor.departmentId}
                isActive={supervisor.isActive}
                permissions={permissions}
                departments={departments as any}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Recent Activity</h3>
                    {recentActivity.length === 0 ? (
                        <p className="text-muted text-sm">No actions recorded yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {recentActivity.map((a: any) => (
                                <div key={a.id} style={{ fontSize: '0.8125rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <Link href={`/dashboard/complaints/${a.complaintId}`} style={{ fontWeight: 500, textDecoration: 'underline' }}>
                                        {a.complaintTitle}
                                    </Link>
                                    <div className="text-muted" style={{ marginTop: '0.125rem' }}>
                                        {getAuditLabel(a.action)} · {new Date(a.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Current Queue (Department)</h3>
                    {currentQueue.length === 0 ? (
                        <p className="text-muted text-sm">Nothing open in this department right now.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {currentQueue.map((c: any) => (
                                <div key={c.id} style={{ fontSize: '0.8125rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                                    <Link href={`/dashboard/complaints/${c.id}`} style={{ fontWeight: 500, textDecoration: 'underline' }}>
                                        {c.title}
                                    </Link>
                                    <div className="text-muted" style={{ marginTop: '0.125rem' }}>
                                        {c.status.replace('_', ' ')} · {c.priority} · {c.assignedOfficerId === supervisor.id ? 'Claimed by them' : c.assignedOfficerId ? 'Claimed by other' : 'Unclaimed'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Fact({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
        <div className={styles.factRow}>
            <span className={styles.factLabel}>{label}</span>
            <span className={styles.factValue} style={{ color: color || undefined }}>{value}</span>
        </div>
    )
}

function formatRelativeTime(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.floor(diffMs / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
}

function getAuditLabel(action: string) {
    switch (action) {
        case 'SUBMITTED': return 'Submitted'
        case 'STATUS_CHANGED_TO_IN_PROGRESS': return 'Claimed'
        case 'STATUS_CHANGED_TO_ESCALATED': return 'Escalated'
        case 'STATUS_CHANGED_TO_RESOLVED': return 'Resolved'
        case 'STATUS_CHANGED_TO_REJECTED': return 'Rejected'
        case 'REROUTED': return 'Rerouted'
        case 'CLOSED': return 'Closed'
        case 'REOPENED': return 'Reopened'
        default: return action.replaceAll('_', ' ')
    }
}
