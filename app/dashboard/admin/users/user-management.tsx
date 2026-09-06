'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Role } from '@/lib/enums'

interface User {
    id: string
    name: string
    email: string
    role: string
    departmentId: string | null
    department?: { name: string } | null
}

interface UserManagementProps {
    initialUsers: User[]
    departments: { id: string, name: string }[]
}

export default function UserManagement({ initialUsers, departments }: UserManagementProps) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<Role>(Role.STUDENT)
    const [showAddModal, setShowAddModal] = useState(false)
    const [loading, setLoading] = useState(false)

    const filteredUsers = initialUsers.filter(u => u.role === activeTab)

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return
        setLoading(true)
        try {
            const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            router.refresh()
        } catch (error) {
            alert('Error deleting user')
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (id: string, newRole: string) => {
        setLoading(true)
        try {
            const res = await fetch(`/api/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            })
            if (!res.ok) throw new Error('Failed to update role')
            router.refresh()
        } catch (error) {
            alert('Error updating role')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {Object.values(Role).map((role) => (
                        <button
                            key={role}
                            onClick={() => setActiveTab(role)}
                            className={`btn ${activeTab === role ? 'btn-primary' : 'btn-outline'}`}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {role.replace('_', ' ')}
                        </button>
                    ))}
                </div>
                <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                    Add User
                </button>
            </div>

            <div className="card">
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '1rem', color: 'var(--muted-foreground)', fontWeight: '500', fontSize: '0.875rem' }}>Name</th>
                                <th style={{ padding: '1rem', color: 'var(--muted-foreground)', fontWeight: '500', fontSize: '0.875rem' }}>Email</th>
                                <th style={{ padding: '1rem', color: 'var(--muted-foreground)', fontWeight: '500', fontSize: '0.875rem' }}>Department</th>
                                <th style={{ padding: '1rem', color: 'var(--muted-foreground)', fontWeight: '500', fontSize: '0.875rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                        No users found in this category.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: '500' }}>{u.name}</div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--muted-foreground)' }}>{u.email}</td>
                                        <td style={{ padding: '1rem' }}>{u.department?.name || '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <select
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                                    className="input"
                                                    style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                    disabled={loading}
                                                >
                                                    {Object.values(Role).map(r => (
                                                        <option key={r} value={r}>{r}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleDelete(u.id)}
                                                    className="btn"
                                                    style={{ padding: '0.25rem 0.5rem', color: '#ef4444', border: '1px solid #ef4444' }}
                                                    disabled={loading}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAddModal && (
                <AddUserModal
                    onClose={() => setShowAddModal(false)}
                    departments={departments}
                />
            )}
        </div>
    )
}

function AddUserModal({ onClose, departments }: { onClose: () => void, departments: { id: string, name: string }[] }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const data = Object.fromEntries(formData.entries())

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })

            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error || 'Failed to create user')
            }

            router.refresh()
            onClose()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Add New User</h2>

                {error && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 0, marginBottom: '1rem' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Name</label>
                        <input name="name" required className="input" placeholder="Full Name" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
                        <input name="email" type="email" required className="input" placeholder="email@giki.edu.pk" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Password</label>
                        <input name="password" type="password" required minLength={6} className="input" placeholder="••••••••" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Role</label>
                        <select name="role" required className="input">
                            {Object.values(Role).map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Department (Optional)</label>
                        <select name="departmentId" className="input">
                            <option value="">None</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
