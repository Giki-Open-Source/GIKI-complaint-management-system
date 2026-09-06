import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const profileSchema = z.object({
    registrationNumber: z.string().min(1).optional(),
    hostelName: z.string().min(1).optional(),
    roomNumber: z.string().min(1).optional(),
    major: z.string().min(1).optional(),
})

export async function GET() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await query(
        `SELECT id, name, email, role, "departmentId", "registrationNumber", "hostelName", "roomNumber", "major"
         FROM "User" WHERE id = $1`,
        [user.id]
    )

    return NextResponse.json({ user: rows[0] })
}

export async function PATCH(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const data = profileSchema.parse(body)

        const setClauses: string[] = []
        const values: unknown[] = []
        for (const [column, value] of Object.entries(data)) {
            values.push(value)
            setClauses.push(`"${column}" = $${values.length}`)
        }

        if (setClauses.length === 0) {
            return NextResponse.json({ error: 'No fields provided' }, { status: 400 })
        }

        values.push(user.id)
        const { rows } = await query(
            `UPDATE "User" SET ${setClauses.join(', ')} WHERE id = $${values.length}
             RETURNING id, name, email, role, "departmentId", "registrationNumber", "hostelName", "roomNumber", "major"`,
            values
        )

        return NextResponse.json({ user: rows[0] })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
