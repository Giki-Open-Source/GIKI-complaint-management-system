import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { getProfileFieldLabels } from '@/lib/profile'
import { normalizePermissions } from '@/lib/permissions'
import ComplaintActions from './actions'
import CommentsSection from './comments'
import Link from 'next/link'
import styles from './complaint-detail.module.css'

export default async function ComplaintDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null
    const { id } = await params

    if (!user) {
        return <div>Unauthorized</div>
    }

    const { rows: complaintRows } = await query(
        `SELECT c.*,
                cu.name AS "complainantName",
                cu.email AS "complainantEmail",
                cu.role AS "complainantRole",
                cu."registrationNumber" AS "complainantRegistrationNumber",
                cu."hostelName" AS "complainantHostelName",
                cu."roomNumber" AS "complainantRoomNumber",
                cu."major" AS "complainantMajor",
                officer.name AS "assignedOfficerName",
                officer.email AS "assignedOfficerEmail",
                d.id AS "assignedDeptId2",
                d.name AS "assignedDeptName",
                d."categoryLabel" AS "assignedDeptCategoryLabel",
                d."slaHours" AS "deptSlaHours",
                d."escalationContactName" AS "deptEscalationContactName",
                d."escalationContactTitle" AS "deptEscalationContactTitle"
         FROM "Complaint" c
         JOIN "User" cu ON cu.id = c."complainantId"
         LEFT JOIN "User" officer ON officer.id = c."assignedOfficerId"
         LEFT JOIN "Department" d ON d.id = c."assignedDeptId"
         WHERE c.id = $1`,
        [id]
    )
    const complaintRow = complaintRows[0]

    if (!complaintRow) {
        return <div>Complaint not found</div>
    }

    const [{ rows: attachments }, { rows: comments }, { rows: departments }, { rows: auditLog }, { rows: supervisors }] = await Promise.all([
        query('SELECT * FROM "Attachment" WHERE "complaintId" = $1', [id]),
        query(
            `SELECT cm.*, jsonb_build_object('name', u.name, 'role', u.role) AS author
             FROM "Comment" cm
             JOIN "User" u ON u.id = cm."authorId"
             WHERE cm."complaintId" = $1
             ORDER BY cm."createdAt" ASC`,
            [id]
        ),
        query('SELECT id, name, "categoryLabel" FROM "Department" ORDER BY "categoryLabel" ASC'),
        query(
            `SELECT al.*, u.name AS "actorName", u.role AS "actorRole"
             FROM "AuditLog" al
             JOIN "User" u ON u.id = al."actorId"
             WHERE al."complaintId" = $1
             ORDER BY al."createdAt" ASC`,
            [id]
        ),
        complaintRow.assignedDeptId
            ? query(
                `SELECT name, email FROM "User" WHERE "departmentId" = $1 AND role = 'DEPT_OFFICER' ORDER BY name`,
                [complaintRow.assignedDeptId]
            )
            : Promise.resolve({ rows: [] as any[] }),
    ])

    const complaint = {
        ...complaintRow,
        complainant: { name: complaintRow.complainantName },
        assignedOfficer: complaintRow.assignedOfficerName ? { name: complaintRow.assignedOfficerName } : null,
        assignedDept: complaintRow.assignedDeptName ? { name: complaintRow.assignedDeptName } : null,
        attachments,
        comments,
    }

    const now = Date.now()
    const createdMs = new Date(complaint.createdAt).getTime()
    const isTerminal = ['RESOLVED', 'CLOSED', 'REJECTED'].includes(complaint.status)
    const slaDeadlineMs = complaintRow.deptSlaHours != null ? createdMs + complaintRow.deptSlaHours * 60 * 60 * 1000 : null
    const isOverdue = slaDeadlineMs != null && !isTerminal && now > slaDeadlineMs
    const openDurationMs = (isTerminal && complaint.closedAt ? new Date(complaint.closedAt).getTime() : now) - createdMs

    // Access control
    const isComplainant = complaint.complainantId === user.id
    const isAssignedOfficer = complaint.assignedOfficerId === user.id
    const isAdmin = user.role === 'ADMIN'
    const isDeptOfficer = user.role === 'DEPT_OFFICER' && complaint.assignedDeptId === user.departmentId
    const isOfficerOrAdmin = isAdmin || isDeptOfficer || isAssignedOfficer

    if (!isComplainant && !isAssignedOfficer && !isAdmin && !isDeptOfficer) {
        return <div>Unauthorized</div>
    }

    const profileLabels = getProfileFieldLabels(complaintRow.complainantRole)

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1rem' }}>
                <Link href="/dashboard" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ← Back to Dashboard
                </Link>
            </div>

            <div className={styles.layout}>
                {/* Main column */}
                <div>
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{complaint.title}</h1>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--muted-foreground)', flexWrap: 'wrap' }}>
                                    <span>{new Date(complaint.createdAt).toLocaleString()}</span>
                                    <span>•</span>
                                    <span>{complaint.category}{complaint.subcategory ? ` — ${complaint.subcategory}` : ''}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                {isOverdue && (
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: 0, fontSize: '0.75rem', fontWeight: '700', backgroundColor: '#ef4444', color: 'white' }}>
                                        OVERDUE
                                    </span>
                                )}
                                <span style={{ padding: '0.25rem 0.75rem', borderRadius: 0, fontSize: '0.75rem', fontWeight: '600', backgroundColor: getPriorityColor(complaint.priority), color: 'white' }}>
                                    {complaint.priority}
                                </span>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: 0,
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    backgroundColor: getStatusColor(complaint.status),
                                    color: 'white'
                                }}>
                                    {complaint.status.replace('_', ' ')}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: complaint.attachments.length ? '2rem' : 0 }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>Description</h3>
                            <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{complaint.description}</p>
                        </div>

                        {complaint.attachments.length > 0 && (
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>Attachments</h3>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    {complaint.attachments.map((file: any) => (
                                        <a
                                            key={file.id}
                                            href={file.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                border: '1px solid var(--border)',
                                                borderRadius: 0,
                                                fontSize: '0.875rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem'
                                            }}
                                        >
                                            📄 {file.name}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {complaint.resolutionSummary && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 0 }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#16a34a' }}>Resolution</h3>
                                <p>{complaint.resolutionSummary}</p>
                            </div>
                        )}

                        {complaint.rejectionReason && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 0 }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#ef4444' }}>Rejected</h3>
                                <p>{complaint.rejectionReason}</p>
                            </div>
                        )}

                        {isOfficerOrAdmin && complaint.internalNotes && (
                            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'var(--secondary)', border: '1px solid var(--border)', borderRadius: 0 }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem' }}>Internal Notes</h3>
                                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted-foreground)' }}>{complaint.internalNotes}</p>
                            </div>
                        )}
                    </div>

                    <ComplaintActions
                        complaintId={complaint.id}
                        currentStatus={complaint.status}
                        isAssignedOfficer={isAssignedOfficer}
                        isAdmin={isAdmin}
                        isDeptOfficer={isDeptOfficer}
                        isComplainant={isComplainant}
                        departments={departments as any}
                        permissions={isAdmin ? null : normalizePermissions(user.permissions)}
                    />

                    <CommentsSection
                        complaintId={complaint.id}
                        initialComments={complaint.comments as any}
                        currentUserEmail={user.email}
                    />
                </div>

                {/* Sidebar */}
                <div className={styles.sidebar}>
                    {/* Status Tracker */}
                    <div className="card">
                        <div className={styles.widgetTitle}>Status Tracker</div>
                        <div className={styles.timeline}>
                            {auditLog.map((entry: any, idx: number) => (
                                <div className={styles.timelineItem} key={entry.id}>
                                    <div className={styles.timelineMarker}>
                                        <div className={styles.timelineDot} style={{ backgroundColor: getAuditColor(entry.action) }} />
                                        {idx < auditLog.length - 1 && <div className={styles.timelineLine} />}
                                    </div>
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineLabel}>{getAuditLabel(entry.action)}</div>
                                        <div className={styles.timelineMeta}>
                                            {new Date(entry.createdAt).toLocaleString()} · {entry.actorName}
                                        </div>
                                        {entry.details && <div className={styles.timelineDetails}>{truncate(entry.details, 140)}</div>}
                                    </div>
                                </div>
                            ))}
                            {complaint.status === 'SUBMITTED' && auditLog.length > 0 && (
                                <div className={styles.timelineItem}>
                                    <div className={styles.timelineMarker}>
                                        <div className={styles.timelineDot} style={{ backgroundColor: 'var(--border)' }} />
                                    </div>
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineLabel} style={{ color: 'var(--muted-foreground)' }}>Awaiting action</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Department & Supervisor */}
                    <div className="card">
                        <div className={styles.widgetTitle}>Department &amp; Supervisor</div>
                        <div className={styles.factRow}>
                            <span className={styles.factLabel}>Department</span>
                            <span className={styles.factValue}>{complaint.assignedDept?.name || 'Unassigned'}</span>
                        </div>
                        <div className={styles.factRow}>
                            <span className={styles.factLabel}>Supervisor{supervisors.length !== 1 ? 's' : ''}</span>
                            <span className={styles.factValue}>
                                {supervisors.length > 0 ? supervisors.map((s: any) => s.name).join(', ') : 'Unassigned'}
                            </span>
                        </div>
                        {complaint.assignedOfficer && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>Claimed By</span>
                                <span className={styles.factValue}>{complaint.assignedOfficer.name}</span>
                            </div>
                        )}
                        {complaintRow.deptSlaHours != null && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>SLA Target</span>
                                <span className={styles.factValue}>{complaintRow.deptSlaHours}h</span>
                            </div>
                        )}
                        {complaintRow.deptEscalationContactName && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>Escalation Contact</span>
                                <span className={styles.factValue}>{complaintRow.deptEscalationContactTitle || complaintRow.deptEscalationContactName}</span>
                            </div>
                        )}
                    </div>

                    {/* Complainant */}
                    <div className="card">
                        <div className={styles.widgetTitle}>Complainant</div>
                        <div className={styles.factRow}>
                            <span className={styles.factLabel}>Name</span>
                            <span className={styles.factValue}>{complaint.complainant.name}</span>
                        </div>
                        <div className={styles.factRow}>
                            <span className={styles.factLabel}>Role</span>
                            <span className={styles.factValue}>{complaintRow.complainantRole}</span>
                        </div>
                        {complaintRow.complainantEmail && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>Email</span>
                                <span className={styles.factValue} style={{ wordBreak: 'break-all' }}>{complaintRow.complainantEmail}</span>
                            </div>
                        )}
                        {complaintRow.complainantRegistrationNumber && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>{profileLabels.registrationNumber}</span>
                                <span className={styles.factValue}>{complaintRow.complainantRegistrationNumber}</span>
                            </div>
                        )}
                        {(complaintRow.complainantHostelName || complaintRow.complainantRoomNumber) && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>{profileLabels.hostelName} / {profileLabels.roomNumber}</span>
                                <span className={styles.factValue}>
                                    {[complaintRow.complainantHostelName, complaintRow.complainantRoomNumber].filter(Boolean).join(' / ')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Key Facts */}
                    <div className="card">
                        <div className={styles.widgetTitle}>Key Facts</div>
                        <div className={styles.factRow}>
                            <span className={styles.factLabel}>{isTerminal ? 'Time to Close' : 'Open For'}</span>
                            <span className={styles.factValue}>{formatDuration(openDurationMs)}</span>
                        </div>
                        {slaDeadlineMs != null && !isTerminal && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>{isOverdue ? 'Overdue By' : 'Time Left (SLA)'}</span>
                                <span className={styles.factValue} style={{ color: isOverdue ? '#ef4444' : undefined }}>
                                    {formatDuration(Math.abs(now - slaDeadlineMs))}
                                </span>
                            </div>
                        )}
                        {complaint.reopenCount > 0 && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>Reopened</span>
                                <span className={styles.factValue} style={{ color: '#eab308' }}>{complaint.reopenCount} time{complaint.reopenCount > 1 ? 's' : ''}</span>
                            </div>
                        )}
                        {complaint.status === 'CLOSED' && complaint.rating && (
                            <div className={styles.factRow}>
                                <span className={styles.factLabel}>Rating</span>
                                <span className={styles.factValue}>{'★'.repeat(complaint.rating)}{'☆'.repeat(5 - complaint.rating)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function truncate(text: string, max: number) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatDuration(ms: number) {
    const totalMinutes = Math.floor(ms / 60000)
    const days = Math.floor(totalMinutes / (60 * 24))
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
    const minutes = totalMinutes % 60
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
}

function getAuditLabel(action: string) {
    switch (action) {
        case 'SUBMITTED': return 'Submitted'
        case 'STATUS_CHANGED_TO_IN_PROGRESS': return 'Claimed'
        case 'STATUS_CHANGED_TO_ESCALATED': return 'Escalated'
        case 'STATUS_CHANGED_TO_RESOLVED': return 'Resolved'
        case 'STATUS_CHANGED_TO_REJECTED': return 'Rejected'
        case 'REROUTED': return 'Rerouted to another department'
        case 'CLOSED': return 'Closed by complainant'
        case 'REOPENED': return 'Reopened by complainant'
        default: return action.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())
    }
}

function getAuditColor(action: string) {
    switch (action) {
        case 'SUBMITTED': return '#3b82f6'
        case 'STATUS_CHANGED_TO_IN_PROGRESS': return '#eab308'
        case 'STATUS_CHANGED_TO_ESCALATED': return '#ef4444'
        case 'STATUS_CHANGED_TO_RESOLVED': return '#22c55e'
        case 'STATUS_CHANGED_TO_REJECTED': return '#64748b'
        case 'REROUTED': return '#8b5cf6'
        case 'CLOSED': return '#8b5cf6'
        case 'REOPENED': return '#f97316'
        default: return '#64748b'
    }
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
