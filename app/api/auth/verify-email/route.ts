import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const { rows } = await query('SELECT id FROM "User" WHERE "verificationToken" = $1', [token])
    const user = rows[0]

    if (!user) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 })
    }

    await query(
        'UPDATE "User" SET "emailVerified" = now(), "verificationToken" = NULL WHERE id = $1',
        [user.id]
    )

    // Redirect to login with success message
    return NextResponse.redirect(new URL('/login?verified=true', request.url))
}
