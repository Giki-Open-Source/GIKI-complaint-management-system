import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'

export default async function ReportsPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    // (a) Total complaint volume by category
    const { rows: categoryRows } = await query(
        'SELECT category, COUNT(id)::int AS count FROM "Complaint" GROUP BY category'
    )
    const complaintsByCategory = categoryRows.map((r: any) => ({ category: r.category, _count: { id: r.count } }))

    // (c) Complaints filtered by status
    const { rows: statusRows } = await query(
        'SELECT status, COUNT(id)::int AS count FROM "Complaint" GROUP BY status'
    )
    const complaintsByStatus = statusRows.map((r: any) => ({ status: r.status, _count: { id: r.count } }))

    // (b) Average Resolution Time (ART) per department — not implemented yet.

    return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>System Reports</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Volume by Category</h3>
                    <ul style={{ listStyle: 'none' }}>
                        {complaintsByCategory.map(item => (
                            <li key={item.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                <span>{item.category}</span>
                                <span style={{ fontWeight: 'bold' }}>{item._count.id}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="card">
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Volume by Status</h3>
                    <ul style={{ listStyle: 'none' }}>
                        {complaintsByStatus.map(item => (
                            <li key={item.status} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                <span>{item.status}</span>
                                <span style={{ fontWeight: 'bold' }}>{item._count.id}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}
