import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const respondSchema = z.object({
    action: z.enum(['close', 'reopen']),
    rating: z.number().int().min(1).max(5).optional(),
    reason: z.string().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { action, rating, reason } = respondSchema.parse(body)
        const { id: complaintId } = await params

        const { rows: complaintRows } = await query('SELECT * FROM "Complaint" WHERE id = $1', [complaintId])
        const complaint = complaintRows[0]

        if (!complaint) {
            return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
        }

        // Only the original complainant can confirm or reopen their own ticket.
        if (complaint.complainantId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        if (complaint.status !== 'RESOLVED') {
            return NextResponse.json({ error: 'Only a resolved complaint can be confirmed or reopened' }, { status: 400 })
        }

        const client = await pool.connect()
        let updated
        try {
            await client.query('BEGIN')

            if (action === 'close') {
                if (!rating) {
                    return NextResponse.json({ error: 'Rating is required' }, { status: 400 })
                }
                const { rows } = await client.query(
                    `UPDATE "Complaint" SET status = 'CLOSED', rating = $1, "closedAt" = now() WHERE id = $2 RETURNING *`,
                    [rating, complaintId]
                )
                updated = rows[0]
                await client.query(
                    `INSERT INTO "AuditLog" (id, action, "actorId", details, "complaintId")
                     VALUES ($1, 'CLOSED', $2, $3, $4)`,
                    [randomUUID(), user.id, `Closed by complainant with rating ${rating}/5`, complaintId]
                )
            } else {
                const { rows } = await client.query(
                    `UPDATE "Complaint" SET status = 'SUBMITTED', "reopenCount" = "reopenCount" + 1 WHERE id = $1 RETURNING *`,
                    [complaintId]
                )
                updated = rows[0]
                await client.query(
                    `INSERT INTO "AuditLog" (id, action, "actorId", details, "complaintId")
                     VALUES ($1, 'REOPENED', $2, $3, $4)`,
                    [randomUUID(), user.id, reason || 'Reopened by complainant', complaintId]
                )
            }

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }

        return NextResponse.json({ complaint: updated })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
