import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// Public: department names/categories aren't sensitive, and this is needed
// pre-auth on both the submit form and the register form (Dept Officer picker).
export async function GET() {
    const { rows: departments } = await query(
        `SELECT id, name, "categoryLabel", "defaultPriority", "slaHours", "escalationContactName", "escalationContactTitle"
         FROM "Department" ORDER BY "categoryLabel" ASC`
    )

    return NextResponse.json({ departments })
}
