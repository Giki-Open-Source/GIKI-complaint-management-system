import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { Role } from '@/lib/enums'

const registerSchema = z.object({
    email: z.string().email().refine(email => email.endsWith('@giki.edu.pk'), {
        message: 'Only @giki.edu.pk emails are allowed'
    }),
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
        const verificationToken = crypto.randomUUID()

        await query(
            `INSERT INTO "User" (id, email, password, name, role, "departmentId", "verificationToken", "emailVerified")
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`,
            [randomUUID(), email, hashedPassword, name, role || Role.STUDENT, departmentId ?? null, verificationToken]
        )

        // MOCK EMAIL SENDING
        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${verificationToken}`
        console.log('----------------------------------------------------------------')
        console.log('📧 MOCK EMAIL: Verify your account')
        console.log(`To: ${email}`)
        console.log(`Link: ${verificationUrl}`)
        console.log('----------------------------------------------------------------')

        // Do NOT log the user in. Return success message.
        return NextResponse.json({
            message: 'Account created successfully. Please check your email to verify your account.'
        })
    } catch (error) {
        console.error('Registration Error:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: (error as any).errors }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
