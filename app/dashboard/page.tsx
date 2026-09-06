import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUserFromToken } from '@/lib/auth'
import Link from 'next/link'
import AdminOverview from './admin-overview'

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) return null

    if (user.role === 'ADMIN') {
        return <AdminOverview name={user.name} />
    }

    // Supervisors work out of their department queue -- they don't file complaints,
    // so the submit/track cards below don't apply to them.
    if (user.role === 'DEPT_OFFICER') {
        redirect('/dashboard/department')
    }

    return (
        <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Welcome, {user.name}</h1>
            <p style={{ color: 'var(--muted-foreground)', marginBottom: '2rem' }}>
                Manage your complaints and track their status here.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Submit a Complaint</h2>
                    <p style={{ marginBottom: '1rem', color: 'var(--muted-foreground)' }}>
                        Have an issue? Submit a new complaint to the relevant department.
                    </p>
                    <Link href="/dashboard/submit" className="btn btn-primary">
                        Submit New Complaint
                    </Link>
                </div>

                <div className="card">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Track Status</h2>
                    <p style={{ marginBottom: '1rem', color: 'var(--muted-foreground)' }}>
                        View the status of your submitted complaints.
                    </p>
                    <Link href="/dashboard/my-complaints" className="btn btn-outline">
                        View My Complaints
                    </Link>
                </div>
            </div>
        </div>
    )
}
