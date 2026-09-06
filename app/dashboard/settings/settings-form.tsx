'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsForm({ isAdmin }: { isAdmin: boolean }) {
    const router = useRouter()

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordError, setPasswordError] = useState('')
    const [passwordSuccess, setPasswordSuccess] = useState('')

    const [deletePassword, setDeletePassword] = useState('')
    const [deleteLoading, setDeleteLoading] = useState(false)
    const [deleteError, setDeleteError] = useState('')

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setPasswordError('')
        setPasswordSuccess('')

        if (newPassword !== confirmPassword) {
            setPasswordError('New passwords do not match')
            return
        }

        setPasswordLoading(true)
        try {
            const res = await fetch('/api/users/me/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to update password')

            setPasswordSuccess('Password updated.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err: any) {
            setPasswordError(err.message)
        } finally {
            setPasswordLoading(false)
        }
    }

    async function handleDeleteAccount() {
        setDeleteError('')

        if (!deletePassword) {
            setDeleteError('Please enter your password to confirm')
            return
        }
        if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) {
            return
        }

        setDeleteLoading(true)
        try {
            const res = await fetch('/api/users/me', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: deletePassword }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to delete account')

            router.push('/')
            router.refresh()
        } catch (err: any) {
            setDeleteError(err.message)
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <form onSubmit={handleChangePassword} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontWeight: '600' }}>Change Password</h3>

                {passwordError && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                        {passwordError}
                    </div>
                )}
                {passwordSuccess && (
                    <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                        {passwordSuccess}
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Current Password</label>
                    <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>New Password</label>
                    <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Confirm New Password</label>
                    <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                </div>

                <button type="submit" disabled={passwordLoading} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    {passwordLoading ? 'Saving...' : 'Update Password'}
                </button>
            </form>

            <div className="card" style={{ borderColor: '#ef4444', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                    <h3 style={{ fontWeight: '600', color: '#ef4444' }}>Danger Zone</h3>
                    <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
                        {isAdmin
                            ? 'Admin accounts cannot be self-deleted here. Ask another admin to remove your account via Manage Users.'
                            : 'Permanently delete your account. This cannot be undone. If you have existing complaints, comments, or activity on file, this will be blocked — contact an admin instead.'}
                    </p>
                </div>

                {!isAdmin && (
                    <>
                        {deleteError && (
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                                {deleteError}
                            </div>
                        )}
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Confirm Password</label>
                            <input type="password" className="input" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
                        </div>
                        <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={deleteLoading}
                            className="btn"
                            style={{ backgroundColor: '#ef4444', color: 'white', alignSelf: 'flex-start' }}
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete My Account'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}
