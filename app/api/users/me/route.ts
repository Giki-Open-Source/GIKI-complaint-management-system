import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken, comparePassword } from '@/lib/auth'
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

const deleteSchema = z.object({
    password: z.string().min(1),
})

export async function DELETE(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role === 'ADMIN') {
        return NextResponse.json({ error: 'Admin accounts cannot be self-deleted. Ask another admin to remove it via Manage Users.' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const { password } = deleteSchema.parse(body)

        const { rows } = await query('SELECT password FROM "User" WHERE id = $1', [user.id])
        const isValid = rows[0] && await comparePassword(password, rows[0].password)

        if (!isValid) {
            return NextResponse.json({ error: 'Incorrect password' }, { status: 400 })
        }

        await query('DELETE FROM "User" WHERE id = $1', [user.id])

        const response = NextResponse.json({ success: true })
        response.cookies.delete('token')
        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        if ((error as { code?: string }).code === '23503') {
            return NextResponse.json({
                error: 'Your account has existing complaints, comments, or activity on file and cannot be deleted directly. Please contact an admin.'
            }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
