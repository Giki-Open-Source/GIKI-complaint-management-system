import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const updateSchema = z.object({
    status: z.enum(['IN_PROGRESS', 'ESCALATED', 'RESOLVED']),
    resolutionSummary: z.string().optional(),
    internalNotes: z.string().optional(),
    escalationReason: z.string().optional(),
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
        const { status, resolutionSummary, internalNotes, escalationReason } = updateSchema.parse(body)
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
