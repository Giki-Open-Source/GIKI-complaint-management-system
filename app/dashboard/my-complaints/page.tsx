import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import Link from 'next/link'


export default async function MyComplaintsPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) return null

    const { rows: complaints } = await query(
        'SELECT * FROM "Complaint" WHERE "complainantId" = $1 ORDER BY "createdAt" DESC',
        [user.id]
    )

    return (
        <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>My Complaints</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {complaints.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--muted-foreground)' }}>
                        No complaints found.
                    </div>
                ) : (
                    complaints.map((complaint: any) => (
                        <Link href={`/dashboard/complaints/${complaint.id}`} key={complaint.id} style={{ textDecoration: 'none' }}>
                            <div className="card" style={{ transition: 'transform 0.2s', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontWeight: '600', fontSize: '1.125rem' }}>{complaint.title}</h3>
                                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: 0,
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: getPriorityColor(complaint.priority),
                                            color: 'white'
                                        }}>
                                            {complaint.priority}
                                        </span>
                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: 0,
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: getStatusColor(complaint.status),
                                            color: 'white'
                                        }}>
                                            {complaint.status}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                                    <span>{complaint.category}</span>
                                    <span>•</span>
                                    <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}

function getStatusColor(status: string) {
    switch (status) {
        case 'SUBMITTED': return '#3b82f6'; // blue
        case 'IN_PROGRESS': return '#eab308'; // yellow
        case 'ESCALATED': return '#ef4444'; // red
        case 'RESOLVED': return '#22c55e'; // green
        case 'CLOSED': return '#8b5cf6'; // purple
        case 'REJECTED': return '#64748b'; // slate
        default: return '#64748b'; // slate
    }
}

function getPriorityColor(priority: string) {
    switch (priority) {
        case 'CRITICAL': return '#dc2626';
        case 'HIGH': return '#ea580c';
        case 'MEDIUM': return '#ca8a04';
        case 'LOW': return '#16a34a';
        default: return '#64748b';
    }
}
