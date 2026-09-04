import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const commentSchema = z.object({
    content: z.string().min(1),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null
    const { id } = await params

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { content } = commentSchema.parse(body)

        // Verify complaint exists and user has access
        const { rows: complaintRows } = await query('SELECT * FROM "Complaint" WHERE id = $1', [id])
        const complaint = complaintRows[0]

        if (!complaint) {
            return NextResponse.json({ error: 'Complaint not found' }, { status: 404 })
        }

        // Access control: Complainant, Assigned Officer, or Admin
        const isComplainant = complaint.complainantId === user.id
        const isAssignedOfficer = complaint.assignedOfficerId === user.id
        const isAdmin = user.role === 'ADMIN'
        const isDeptOfficer = user.role === 'DEPT_OFFICER' && complaint.assignedDeptId === user.departmentId

        if (!isComplainant && !isAssignedOfficer && !isAdmin && !isDeptOfficer) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const { rows } = await query(
            `WITH ins AS (
                INSERT INTO "Comment" (id, content, "complaintId", "authorId")
                VALUES ($1, $2, $3, $4) RETURNING *
             )
             SELECT ins.*, jsonb_build_object('name', u.name, 'role', u.role) AS author
             FROM ins JOIN "User" u ON u.id = ins."authorId"`,
            [randomUUID(), content, id, user.id]
        )
        const comment = rows[0]

        return NextResponse.json({ comment })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
