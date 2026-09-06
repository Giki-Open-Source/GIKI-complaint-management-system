import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { getRequiredProfileFields } from '@/lib/profile'
import ProfileForm from './profile-form'

export default async function ProfilePage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return <div>Unauthorized</div>
    }

    // Admins have no complaint-routing profile of their own; account settings
    // (name/password) live under Settings instead.
    if (user.role === 'ADMIN') {
        redirect('/dashboard/settings')
    }

    const { rows } = await query(
        `SELECT id, name, email, role, "registrationNumber", "hostelName", "roomNumber", "major", "gender"
         FROM "User" WHERE id = $1`,
        [user.id]
    )
    const profile = rows[0]

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>My Profile</h1>
            <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                {getRequiredProfileFields(user.role).length > 0
                    ? 'These details tell the department handling your complaint exactly where to go — please keep them up to date.'
                    : 'Your contact details on file.'}
            </p>
            <ProfileForm profile={profile} />
        </div>
    )
}
