import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken, hashPassword } from '@/lib/auth'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { Role } from '@/lib/enums'

const createUserSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.nativeEnum(Role),
    departmentId: z.string().optional(),
})

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const data = createUserSchema.parse(body)

        const { rows: existingRows } = await query('SELECT id FROM "User" WHERE email = $1', [data.email])

        if (existingRows.length > 0) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 })
        }

        const hashedPassword = await hashPassword(data.password)

        const { rows } = await query(
            `INSERT INTO "User" (id, name, email, password, role, "departmentId")
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, email, role, "departmentId", "emailVerified", "verificationToken", "createdAt", "updatedAt"`,
            [randomUUID(), data.name, data.email, hashedPassword, data.role, data.departmentId || null]
        )

        return NextResponse.json({ user: rows[0] })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
