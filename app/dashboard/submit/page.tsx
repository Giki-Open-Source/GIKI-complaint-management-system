import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { isProfileComplete, getMissingProfileFields, getProfileFieldLabels } from '@/lib/profile'
import Link from 'next/link'
import SubmitForm from './submit-form'

export default async function SubmitComplaintPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return <div>Unauthorized</div>
    }

    const { rows } = await query(
        `SELECT "registrationNumber", "hostelName", "roomNumber", "major" FROM "User" WHERE id = $1`,
        [user.id]
    )
    const profile = { ...rows[0], role: user.role }

    if (!isProfileComplete(profile)) {
        const labels = getProfileFieldLabels(user.role)
        const missing = getMissingProfileFields(profile)

        return (
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Submit a Complaint</h1>
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Complete your profile first</h3>
                    <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                        The department handling your complaint needs to know where to go. Please fill in: {missing.map(f => labels[f]).join(', ')}.
                    </p>
                    <Link href="/dashboard/profile" className="btn btn-primary">Complete Profile</Link>
                </div>
            </div>
        )
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Submit a Complaint</h1>
            <SubmitForm hostelName={profile.hostelName} />
        </div>
    )
}
