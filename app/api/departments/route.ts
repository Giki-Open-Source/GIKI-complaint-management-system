import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows: departments } = await query(
        `SELECT id, name, "categoryLabel", "defaultPriority", "slaHours", "escalationContactName", "escalationContactTitle"
         FROM "Department" ORDER BY "categoryLabel" ASC`
    )

    return NextResponse.json({ departments })
}
