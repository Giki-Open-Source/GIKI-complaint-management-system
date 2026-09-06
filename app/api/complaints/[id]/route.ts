import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { normalizePermissions } from '@/lib/permissions'

const updateSchema = z.object({
    status: z.enum(['IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'REJECTED']).optional(),
    resolutionSummary: z.string().optional(),
    internalNotes: z.string().optional(),
    escalationReason: z.string().optional(),
    rejectionReason: z.string().optional(),
    assignedDeptId: z.string().optional(), // reroute: change department while still SUBMITTED
    resolutionProof: z.object({
        url: z.string(),
        name: z.string(),
        size: z.number(),
    }).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { status, resolutionSummary, internalNotes, escalationReason, rejectionReason, assignedDeptId, resolutionProof } = updateSchema.parse(body)
        const { id: complaintId } = await params

        const { rows: complaintRows } = await query('SELECT * FROM "Complaint" WHERE id = $1', [complaintId])
        const complaint = complaintRows[0]

        if (!complaint) {
            return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
        }

        // Authorization checks
        const isOfficer = user.role === 'DEPT_OFFICER' && user.departmentId === complaint.assignedDeptId
        const isAdmin = user.role === 'ADMIN'

        if (!isOfficer && !isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Reroute: assignedDeptId provided with no status change, only while still SUBMITTED
        // (a miscategorized ticket goes back to routing, not to a specific officer).
        if (assignedDeptId && !status) {
            if (complaint.status !== 'SUBMITTED') {
                return NextResponse.json({ error: 'Can only reroute a complaint that has not been claimed yet' }, { status: 400 })
            }

            if (user.role === 'DEPT_OFFICER' && !normalizePermissions(user.permissions).canReroute) {
                return NextResponse.json({ error: 'You do not have permission to reroute complaints' }, { status: 403 })
            }

            const client = await pool.connect()
            let rerouted
            try {
                await client.query('BEGIN')
                const { rows } = await client.query(
                    `UPDATE "Complaint" SET "assignedDeptId" = $1 WHERE id = $2 RETURNING *`,
                    [assignedDeptId, complaintId]
                )
                rerouted = rows[0]
                await client.query(
                    `INSERT INTO "AuditLog" (id, action, "actorId", details, "complaintId")
                     VALUES ($1, 'REROUTED', $2, $3, $4)`,
                    [randomUUID(), user.id, `Rerouted from department ${complaint.assignedDeptId} to ${assignedDeptId}`, complaintId]
                )
                await client.query('COMMIT')
            } catch (error) {
                await client.query('ROLLBACK')
                throw error
            } finally {
                client.release()
            }

            return NextResponse.json({ complaint: rerouted })
        }

        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 })
        }

        // Fine-grained per-officer permission gate. Re-sending the current status
        // (the "save internal notes" form does this) isn't a real transition, so
        // it's exempt -- only an actual claim/resolve/escalate/reject needs the
        // matching permission. Admins are never gated by this.
        if (user.role === 'DEPT_OFFICER') {
            const permissions = normalizePermissions(user.permissions)
            const permissionKeyByStatus: Record<string, keyof typeof permissions> = {
                IN_PROGRESS: 'canClaim',
                RESOLVED: 'canResolve',
                ESCALATED: 'canEscalate',
                REJECTED: 'canReject',
            }
            const isRedundantResend = status === complaint.status
            const requiredKey = permissionKeyByStatus[status]
            if (requiredKey && !isRedundantResend && !permissions[requiredKey]) {
                return NextResponse.json({ error: `You do not have permission to perform this action (${requiredKey})` }, { status: 403 })
            }
        }

        // Logic for transitions
        const updates: any = { status }
        let auditAction = `STATUS_CHANGED_TO_${status}`
        let auditDetails = ''

        if (status === 'IN_PROGRESS') {
            updates.assignedOfficerId = user.id
            auditDetails = 'Complaint claimed by officer'
        } else if (status === 'RESOLVED') {
            if (!resolutionSummary) {
                return NextResponse.json({ error: 'Resolution summary is required' }, { status: 400 })
            }
            updates.resolutionSummary = resolutionSummary
            auditDetails = `Resolved: ${resolutionSummary}`
        } else if (status === 'ESCALATED') {
            if (!escalationReason) {
                return NextResponse.json({ error: 'Escalation reason is required' }, { status: 400 })
            }
            auditDetails = `Escalated: ${escalationReason}`
        } else if (status === 'REJECTED') {
            if (complaint.status !== 'SUBMITTED') {
                return NextResponse.json({ error: 'Can only reject a complaint that has not been claimed yet' }, { status: 400 })
            }
            if (!rejectionReason) {
                return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
            }
            updates.rejectionReason = rejectionReason
            auditDetails = `Rejected: ${rejectionReason}`
        }

        if (internalNotes) {
            updates.internalNotes = internalNotes
        }

        const setClauses: string[] = []
        const values: unknown[] = []
        for (const [column, value] of Object.entries(updates)) {
            values.push(value)
            setClauses.push(`"${column}" = $${values.length}`)
        }
        values.push(complaintId)

        const client = await pool.connect()
        let updatedComplaint
        try {
            await client.query('BEGIN')

            const { rows } = await client.query(
                `UPDATE "Complaint" SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
                values
            )
            updatedComplaint = rows[0]

            if (status === 'RESOLVED' && resolutionProof) {
                await client.query(
                    `INSERT INTO "Attachment" (id, url, name, size, "complaintId")
                     VALUES ($1, $2, $3, $4, $5)`,
                    [randomUUID(), resolutionProof.url, resolutionProof.name, resolutionProof.size, complaintId]
                )
            }

            await client.query(
                `INSERT INTO "AuditLog" (id, action, "actorId", details, "complaintId")
                 VALUES ($1, $2, $3, $4, $5)`,
                [randomUUID(), auditAction, user.id, auditDetails, complaintId]
            )

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }

        return NextResponse.json({ complaint: updatedComplaint })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
