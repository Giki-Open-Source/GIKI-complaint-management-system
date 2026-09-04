import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { comparePassword, signToken } from '@/lib/auth'
import { z } from 'zod'

const verifyOtpSchema = z.object({
    email: z.string().email(),
    code: z.string().length(6),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, code } = verifyOtpSchema.parse(body)

        const { rows } = await query('SELECT * FROM "User" WHERE email = $1', [email])
        const user = rows[0]

        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
        }

        if (user.emailVerified) {
            return NextResponse.json({ error: 'Email already verified' }, { status: 400 })
        }

        if (!user.otpCode || !user.otpExpiresAt || new Date(user.otpExpiresAt) < new Date()) {
            return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 })
        }

        if (!(await comparePassword(code, user.otpCode))) {
            return NextResponse.json({ error: 'Incorrect code' }, { status: 400 })
        }

        await query(
            `UPDATE "User" SET "emailVerified" = now(), "otpCode" = NULL, "otpExpiresAt" = NULL WHERE id = $1`,
            [user.id]
        )

        const token = signToken({
            userId: user.id,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId,
        })

        const response = NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                departmentId: user.departmentId,
            },
        })

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 86400,
            path: '/',
        })

        return response
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
