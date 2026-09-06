import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import {
    buildHostelComplaintWhere,
    describeHostelFilters,
    HOSTEL_COMPLAINT_SELECT,
    HOSTEL_COMPLAINT_FROM,
    type HostelComplaintFilters,
} from '@/lib/hostel-filters'
import { buildCsv, buildPdf, exportFilename, type ExportColumn } from '@/lib/export'

// Guard rail: a filter-less export of a huge table would otherwise try to render
// every row into one PDF.
const MAX_EXPORT_ROWS = 5000

type Row = {
    id: string
    title: string
    subcategory: string | null
    category: string
    status: string
    priority: string
    createdAt: string
    studentName: string
    registrationNumber: string | null
    roomNumber: string | null
    hostelName: string
    supervisorNames: string | null
}

function formatDate(value: string) {
    const d = new Date(value)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const COLUMNS: ExportColumn<Row>[] = [
    { header: 'Reg. No.', width: 8, value: r => r.registrationNumber || '-' },
    { header: 'Student Name', width: 12, value: r => r.studentName },
    { header: 'Hostel', width: 10, value: r => r.hostelName },
    { header: 'Room', width: 5, value: r => r.roomNumber || '-' },
    { header: 'Supervisor', width: 12, value: r => r.supervisorNames || 'Unassigned' },
    { header: 'Type of Work', width: 14, value: r => r.subcategory || r.category },
    { header: 'Complaint Title', width: 20, value: r => r.title },
    { header: 'Priority', width: 7, value: r => r.priority },
    { header: 'Status', width: 8, value: r => r.status.replace('_', ' ') },
    { header: 'Date Created', width: 11, value: r => formatDate(r.createdAt) },
]

export async function GET(request: Request) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'csv'

    const filters: HostelComplaintFilters = {
        hostel: url.searchParams.get('hostel') || undefined,
        supervisor: url.searchParams.get('supervisor') || undefined,
        status: url.searchParams.get('status') || undefined,
        workType: url.searchParams.get('workType') || undefined,
        regNo: url.searchParams.get('regNo') || undefined,
        q: url.searchParams.get('q') || undefined,
        from: url.searchParams.get('from') || undefined,
        to: url.searchParams.get('to') || undefined,
    }

    // Same WHERE clause the on-screen ledger uses, minus its pagination, so the
    // export covers every matching record rather than the visible page.
    const { whereSql, values } = await buildHostelComplaintWhere(filters)

    const { rows } = await query<Row>(
        `SELECT ${HOSTEL_COMPLAINT_SELECT}
         ${HOSTEL_COMPLAINT_FROM}
         ${whereSql}
         ORDER BY c."createdAt" DESC
         LIMIT ${MAX_EXPORT_ROWS}`,
        values
    )

    if (format === 'csv') {
        const csv = buildCsv(rows, COLUMNS)
        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportFilename('hostel-complaints', 'csv')}"`,
            },
        })
    }

    const pdf = await buildPdf(rows, COLUMNS, {
        title: 'Hostel Complaints - Maintenance Ticket Register',
        moduleCode: 'HMS-COMPLAINTS-01',
        filters: await describeHostelFilters(filters),
        generatedBy: user.name || user.email,
        totalRecords: rows.length,
    })

    return new NextResponse(new Uint8Array(pdf), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${exportFilename('hostel-complaints', 'pdf')}"`,
        },
    })
}
