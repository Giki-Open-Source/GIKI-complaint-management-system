import { NextResponse } from 'next/server'
import { pool, query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { isProfileComplete, getMissingProfileFields, getProfileFieldLabels } from '@/lib/profile'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const complaintSchema = z.object({
    title: z.string().min(5),
    description: z.string().min(10),
    departmentId: z.string(),
    subcategory: z.string().optional(),
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

    const { rows: profileRows } = await query(
        `SELECT "registrationNumber", "hostelName", "roomNumber", "major" FROM "User" WHERE id = $1`,
        [user.id]
    )
    const profile = { ...profileRows[0], role: user.role }
    if (!isProfileComplete(profile)) {
        const labels = getProfileFieldLabels(user.role)
        const missing = getMissingProfileFields(profile).map(f => labels[f])
        return NextResponse.json({ error: `Please complete your profile first: ${missing.join(', ')}` }, { status: 400 })
    }

    try {
        const body = await request.json()
        const { title, description, departmentId, subcategory, attachments } = complaintSchema.parse(body)

        // Routing is now a direct FK assignment: the department the student
        // picked IS the category. category/priority are denormalized from it
        // at submission time so they stay accurate even if the department is
        // later renamed or its default priority changes.
        const { rows: deptRows } = await query(
            'SELECT id, "categoryLabel", name, "defaultPriority" FROM "Department" WHERE id = $1',
            [departmentId]
        )
        const department = deptRows[0]
        if (!department) {
            return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
        }

        const client = await pool.connect()
        let complaint
        let insertedAttachments: any[] = []
        try {
            await client.query('BEGIN')

            const complaintId = randomUUID()
            const { rows } = await client.query(
                `INSERT INTO "Complaint" (id, title, description, category, subcategory, priority, "complainantId", "assignedDeptId")
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [complaintId, title, description, department.categoryLabel || department.name, subcategory ?? null, department.defaultPriority, user.id, department.id]
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
