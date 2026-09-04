import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { Role } from '@/lib/enums'

const updateUserSchema = z.object({
    role: z.nativeEnum(Role).optional(),
    departmentId: z.string().nullable().optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null
    const { id } = await params

    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const data = updateUserSchema.parse(body)

        const updates: Record<string, unknown> = {}
        if (data.role) updates.role = data.role
        if (data.departmentId !== undefined) updates.departmentId = data.departmentId

        if (Object.keys(updates).length === 0) {
            const { rows } = await query(
                'SELECT id, name, email, role, "departmentId", "emailVerified", "verificationToken", "createdAt", "updatedAt" FROM "User" WHERE id = $1',
                [id]
            )
            return NextResponse.json({ user: rows[0] })
        }

        const setClauses: string[] = []
        const values: unknown[] = []
        for (const [column, value] of Object.entries(updates)) {
            values.push(value)
            setClauses.push(`"${column}" = $${values.length}`)
        }
        values.push(id)

        const { rows } = await query(
            `UPDATE "User" SET ${setClauses.join(', ')} WHERE id = $${values.length}
             RETURNING id, name, email, role, "departmentId", "emailVerified", "verificationToken", "createdAt", "updatedAt"`,
            values
        )

        return NextResponse.json({ user: rows[0] })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null
    const { id } = await params

    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.id === id) {
        return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    try {
        await query('DELETE FROM "User" WHERE id = $1', [id])

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }
}
