import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const complaintSchema = z.object({
    title: z.string().min(5),
    description: z.string().min(10),
    category: z.string(),
    attachments: z.array(z.object({
        url: z.string(),
        name: z.string(),
        size: z.number(),
    })).max(3).optional(),
})

// GET: List complaints for current user
export async function GET(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows: complaints } = await query(
        'SELECT * FROM "Complaint" WHERE "complainantId" = $1 ORDER BY "createdAt" DESC',
        [user.id]
    )

    const complaintIds = complaints.map((c: any) => c.id)
    const { rows: attachments } = complaintIds.length
        ? await query('SELECT * FROM "Attachment" WHERE "complaintId" = ANY($1)', [complaintIds])
        : { rows: [] as any[] }

    const complaintsWithAttachments = complaints.map((c: any) => ({
        ...c,
        attachments: attachments.filter((a: any) => a.complaintId === c.id),
    }))

    return NextResponse.json({ complaints: complaintsWithAttachments })
}

// POST: Create new complaint
export async function POST(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        console.log('Received complaint body:', body)
        const { title, description, category, attachments } = complaintSchema.parse(body)

        // Auto-route based on category (Simple logic for now)
        // In a real app, this would query the Category-Department mapping
        const { rows: deptRows } = await query(
            'SELECT id FROM "Department" WHERE name ILIKE $1 LIMIT 1', // Naive matching
            [`%${category}%`]
        )
        const assignedDeptId = deptRows[0]?.id ?? null

        const client = await pool.connect()
        let complaint
        let insertedAttachments: any[] = []
        try {
            await client.query('BEGIN')

            const complaintId = randomUUID()
            const { rows } = await client.query(
                `INSERT INTO "Complaint" (id, title, description, category, "complainantId", "assignedDeptId")
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [complaintId, title, description, category, user.id, assignedDeptId]
            )
            complaint = rows[0]

            for (const attachment of attachments ?? []) {
                const { rows: attRows } = await client.query(
                    `INSERT INTO "Attachment" (id, url, name, size, "complaintId")
                     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                    [randomUUID(), attachment.url, attachment.name, attachment.size, complaintId]
                )
                insertedAttachments.push(attRows[0])
            }

            await client.query(
                `INSERT INTO "AuditLog" (id, action, "actorId", details, "complaintId")
                 VALUES ($1, 'SUBMITTED', $2, 'Complaint submitted', $3)`,
                [randomUUID(), user.id, complaintId]
            )

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }

        return NextResponse.json({ complaint: { ...complaint, attachments: insertedAttachments } })
    } catch (error) {
        console.error('Complaint submission error:', error)
        if (error instanceof z.ZodError) {
            console.log('Validation errors:', error.issues)
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
