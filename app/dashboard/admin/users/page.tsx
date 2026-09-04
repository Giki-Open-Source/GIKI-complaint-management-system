import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import UserManagement from './user-management'

export default async function UserManagementPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user || user.role !== 'ADMIN') {
        return <div>Unauthorized</div>
    }

    const [{ rows: userRows }, { rows: departments }] = await Promise.all([
        query(
            `SELECT u.id, u.name, u.email, u.role, u."departmentId", d.name AS "departmentName"
             FROM "User" u
             LEFT JOIN "Department" d ON d.id = u."departmentId"
             ORDER BY u.name ASC`
        ),
        query('SELECT * FROM "Department" ORDER BY name ASC')
    ])
    const users = userRows.map((u: any) => ({
        ...u,
        department: u.departmentName ? { name: u.departmentName } : null,
    }))

    return (
        <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '2rem' }}>User Management</h1>
            <UserManagement initialUsers={users} departments={departments} />
        </div>
    )
}
