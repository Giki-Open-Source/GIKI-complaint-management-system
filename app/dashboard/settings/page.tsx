import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import SettingsForm from './settings-form'

export default async function SettingsPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return <div>Unauthorized</div>
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Settings</h1>
            <SettingsForm isAdmin={user.role === 'ADMIN'} />
        </div>
    )
}
