import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { generateOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { Role } from '@/lib/enums'

const registerSchema = z.object({
    email: z.string().email().refine(
        email => email.endsWith('@giki.edu.pk') || email === process.env.TEST_ALLOWED_EMAIL,
        { message: 'Only @giki.edu.pk emails are allowed' }
    ),
    password: z.string().min(6),
    name: z.string().min(2),
    role: z.nativeEnum(Role).optional(),
    departmentId: z.string().optional(),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email, password, name, role, departmentId } = registerSchema.parse(body)

        const { rows: existingRows } = await query('SELECT id FROM "User" WHERE email = $1', [email])

        if (existingRows.length > 0) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 })
        }

        const hashedPassword = await hashPassword(password)
        const otpCode = generateOtp()
        const hashedOtp = await hashPassword(otpCode)
        const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)

        await query(
            `INSERT INTO "User" (id, email, password, name, role, "departmentId", "otpCode", "otpExpiresAt", "emailVerified")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
            [randomUUID(), email, hashedPassword, name, role || Role.STUDENT, departmentId ?? null, hashedOtp, otpExpiresAt]
        )

        await sendOtpEmail(email, otpCode)

        // Do NOT log the user in yet — they still need to verify the OTP.
        return NextResponse.json({
            message: 'Account created. Check your email for a verification code.'
        })
    } catch (error) {
        console.error('Registration Error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
