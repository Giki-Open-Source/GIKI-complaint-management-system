import Link from 'next/link'
import { query } from '@/lib/db'
import styles from './overview.module.css'

const ACTIVE_STATUSES = `('RESOLVED', 'CLOSED', 'REJECTED')`

export default async function AdminOverview({ name }: { name: string }) {
    const [
        { rows: statRows },
        { rows: needsAttention },
        { rows: routingQueue },
        { rows: coverageGaps },
        { rows: recentActivity },
    ] = await Promise.all([
        // One pass for the whole KPI strip. "overdue" needs the department's SLA,
        // so it joins rather than being a plain FILTER on Complaint.
        query(
            `SELECT
                COUNT(*) FILTER (WHERE c.status NOT IN ${ACTIVE_STATUSES})::int AS open,
                COUNT(*) FILTER (WHERE c.status = 'SUBMITTED')::int AS unclaimed,
                COUNT(*) FILTER (WHERE c.status = 'ESCALATED')::int AS escalated,
                COUNT(*) FILTER (WHERE c."createdAt" >= date_trunc('day', now()))::int AS today,
                COUNT(*) FILTER (
                    WHERE c.status NOT IN ${ACTIVE_STATUSES}
                    AND d."slaHours" IS NOT NULL
                    AND now() - c."createdAt" > (d."slaHours" || ' hours')::interval
                )::int AS overdue
             FROM "Complaint" c
             LEFT JOIN "Department" d ON d.id = c."assignedDeptId"`
        ),
        // Daily triage list: escalated or past SLA, oldest first.
        query(
            `SELECT c.id, c.title, c.status, c.priority, c."createdAt", d.name AS "deptName",
                    (d."slaHours" IS NOT NULL AND now() - c."createdAt" > (d."slaHours" || ' hours')::interval) AS "isOverdue"
             FROM "Complaint" c
             LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
             WHERE c.status NOT IN ${ACTIVE_STATUSES}
               AND (c.status = 'ESCALATED'
                    OR (d."slaHours" IS NOT NULL AND now() - c."createdAt" > (d."slaHours" || ' hours')::interval))
             ORDER BY c."createdAt" ASC
             LIMIT 8`
        ),
        // Submitted but nobody has picked it up yet -- the admin's assignment work.
        query(
            `SELECT c.id, c.title, c."createdAt", d.name AS "deptName"
             FROM "Complaint" c
             LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
             WHERE c.status = 'SUBMITTED'
             ORDER BY c."createdAt" ASC
             LIMIT 8`
        ),
        // Departments carrying open work with no active supervisor to act on it.
        query(
            `SELECT * FROM (
                SELECT d.id, d.name,
                    (SELECT COUNT(*)::int FROM "Complaint" c
                     WHERE c."assignedDeptId" = d.id AND c.status NOT IN ${ACTIVE_STATUSES}) AS "openCount"
                FROM "Department" d
                WHERE NOT EXISTS (
                    SELECT 1 FROM "User" u
                    WHERE u."departmentId" = d.id AND u.role = 'DEPT_OFFICER' AND u."isActive" = true
                )
             ) gaps
             WHERE "openCount" > 0
             ORDER BY "openCount" DESC, name ASC
             LIMIT 6`
        ),
        query(
            `SELECT al.id, al.action, al."createdAt", al."complaintId",
                    u.name AS "actorName", c.title AS "complaintTitle"
             FROM "AuditLog" al
             JOIN "User" u ON u.id = al."actorId"
             LEFT JOIN "Complaint" c ON c.id = al."complaintId"
             ORDER BY al."createdAt" DESC
             LIMIT 8`
        ),
    ])

    const s = statRows[0]

    return (
        <div>
            <div style={{ marginBottom: '1rem' }}>
                <h1 style={{ fontSize: '1.375rem', fontWeight: 'bold' }}>Operations Overview</h1>
                <p className="text-muted text-sm">Signed in as {name}</p>
            </div>

            <div className={styles.kpiStrip}>
                <Kpi label="Open" value={s.open} href="/dashboard/admin/hostels" />
                <Kpi label="New Today" value={s.today} href="/dashboard/admin/hostels" />
                <Kpi label="Unclaimed" value={s.unclaimed} href="/dashboard/admin/hostels?status=SUBMITTED" flag={s.unclaimed > 0} />
                <Kpi label="Overdue" value={s.overdue} href="/dashboard/admin/hostels" flag={s.overdue > 0} />
                <Kpi label="Escalated" value={s.escalated} href="/dashboard/admin/hostels?status=ESCALATED" flag={s.escalated > 0} />
            </div>

            <div className={styles.panelGrid}>
                <Panel title="Needs Attention" hint="Escalated or past SLA" href="/dashboard/admin/hostels?status=ESCALATED">
                    {needsAttention.length === 0 ? (
                        <div className={styles.empty}>Nothing escalated or overdue.</div>
                    ) : needsAttention.map((c: any) => (
                        <div className={styles.row} key={c.id}>
                            <div className={styles.rowMain}>
                                <Link href={`/dashboard/complaints/${c.id}`} className={styles.rowTitle}>{c.title}</Link>
                                <div className={styles.rowMeta}>
                                    {c.deptName || 'No department'} · {c.priority} · {daysOld(c.createdAt)}d old
                                </div>
                            </div>
                            <div className={styles.rowSide}>
                                {c.status === 'ESCALATED' && <div className={styles.flag}>ESCALATED</div>}
                                {c.isOverdue && <div className={styles.flag}>OVERDUE</div>}
                            </div>
                        </div>
                    ))}
                </Panel>

                <Panel title="Awaiting Assignment" hint="Submitted, not yet claimed" href="/dashboard/admin/hostels?status=SUBMITTED">
                    {routingQueue.length === 0 ? (
                        <div className={styles.empty}>Everything submitted has been claimed.</div>
                    ) : routingQueue.map((c: any) => (
                        <div className={styles.row} key={c.id}>
                            <div className={styles.rowMain}>
                                <Link href={`/dashboard/complaints/${c.id}`} className={styles.rowTitle}>{c.title}</Link>
                                <div className={styles.rowMeta}>
                                    {c.deptName || <span className={styles.flag}>No department</span>} · {daysOld(c.createdAt)}d waiting
                                </div>
                            </div>
                        </div>
                    ))}
                </Panel>

                <Panel title="Coverage Gaps" hint="Open work, no active supervisor" href="/dashboard/admin/supervisors">
                    {coverageGaps.length === 0 ? (
                        <div className={styles.empty}>Every department with open work has a supervisor.</div>
                    ) : coverageGaps.map((d: any) => (
                        <div className={styles.row} key={d.id}>
                            <div className={styles.rowMain}>
                                <span style={{ fontWeight: 500 }}>{d.name}</span>
                                <div className={styles.rowMeta}>No active supervisor assigned</div>
                            </div>
                            <div className={styles.rowSide}>
                                <span className={styles.flag}>{d.openCount} open</span>
                            </div>
                        </div>
                    ))}
                </Panel>

                <Panel title="Recent Activity">
                    {recentActivity.length === 0 ? (
                        <div className={styles.empty}>No activity recorded yet.</div>
                    ) : recentActivity.map((a: any) => (
                        <div className={styles.row} key={a.id}>
                            <div className={styles.rowMain}>
                                {a.complaintId ? (
                                    <Link href={`/dashboard/complaints/${a.complaintId}`} className={styles.rowTitle}>
                                        {a.complaintTitle || 'Complaint'}
                                    </Link>
                                ) : (
                                    <span style={{ fontWeight: 500 }}>{a.complaintTitle || 'Complaint'}</span>
                                )}
                                <div className={styles.rowMeta}>{auditLabel(a.action)} · {a.actorName}</div>
                            </div>
                            <div className={styles.rowSide}>{relativeTime(a.createdAt)}</div>
                        </div>
                    ))}
                </Panel>
            </div>
        </div>
    )
}

function Kpi({ label, value, href, flag }: { label: string; value: number; href: string; flag?: boolean }) {
    return (
        <Link href={href} className={styles.kpi}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiValue} style={{ color: flag ? '#eab308' : undefined }}>{value}</div>
        </Link>
    )
}

function Panel({ title, hint, href, children }: { title: string; hint?: string; href?: string; children: React.ReactNode }) {
    return (
        <div className={styles.panel}>
            <div className={styles.panelHead}>
                <span className={styles.panelTitle}>{title}</span>
                {href
                    ? <Link href={href} className={styles.panelLink}>{hint || 'View all'} →</Link>
                    : hint && <span className={styles.panelLink}>{hint}</span>}
            </div>
            {children}
        </div>
    )
}

function daysOld(iso: string) {
    return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function relativeTime(iso: string) {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
}

function auditLabel(action: string) {
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
