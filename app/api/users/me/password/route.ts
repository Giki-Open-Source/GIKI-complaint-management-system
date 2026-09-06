import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken, comparePassword, hashPassword } from '@/lib/auth'
import { cookies } from 'next/headers'
import { z } from 'zod'

const passwordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
})

export async function POST(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { currentPassword, newPassword } = passwordSchema.parse(body)

        const { rows } = await query('SELECT password FROM "User" WHERE id = $1', [user.id])
        const isValid = rows[0] && await comparePassword(currentPassword, rows[0].password)

        if (!isValid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }

        const hashed = await hashPassword(newPassword)
        await query('UPDATE "User" SET password = $1 WHERE id = $2', [hashed, user.id])

        return NextResponse.json({ message: 'Password updated.' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
