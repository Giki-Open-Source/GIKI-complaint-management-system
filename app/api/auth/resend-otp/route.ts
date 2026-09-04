import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { generateOtp, OTP_TTL_MS } from '@/lib/otp'
import { sendOtpEmail } from '@/lib/email'
import { z } from 'zod'

const resendSchema = z.object({
    email: z.string().email(),
})

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { email } = resendSchema.parse(body)

        const { rows } = await query('SELECT id, "emailVerified" FROM "User" WHERE email = $1', [email])
        const user = rows[0]

        if (!user) {
            return NextResponse.json({ error: 'No account found for this email' }, { status: 404 })
        }

        if (user.emailVerified) {
            return NextResponse.json({ error: 'Email already verified' }, { status: 400 })
        }

        const otpCode = generateOtp()
        const hashedOtp = await hashPassword(otpCode)
        const otpExpiresAt = new Date(Date.now() + OTP_TTL_MS)

        await query(
            `UPDATE "User" SET "otpCode" = $1, "otpExpiresAt" = $2 WHERE id = $3`,
            [hashedOtp, otpExpiresAt, user.id]
        )

        await sendOtpEmail(email, otpCode)

        return NextResponse.json({ message: 'A new code has been sent.' })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
