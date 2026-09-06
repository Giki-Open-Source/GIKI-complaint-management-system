'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PERMISSION_DEFS, OfficerPermissions } from '@/lib/permissions'
import { ToggleSwitch, ConfirmModal, InlineBanner } from '../ui'

interface Department {
    id: string
    name: string
    isHostel: boolean
}

interface Props {
    supervisorId: string
    phone: string | null
    departmentId: string | null
    isActive: boolean
    permissions: OfficerPermissions
    departments: Department[]
}

export default function SupervisorDetailActions({ supervisorId, phone, departmentId, isActive, permissions, departments }: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [confirming, setConfirming] = useState<'suspend' | 'activate' | 'delete' | null>(null)
    const [phoneValue, setPhoneValue] = useState(phone || '')
    const [deptValue, setDeptValue] = useState(departmentId || '')
    const [permValues, setPermValues] = useState<OfficerPermissions>(permissions)

    const isDirty = useMemo(() => {
        if (phoneValue !== (phone || '')) return true
        if (deptValue !== (departmentId || '')) return true
        return PERMISSION_DEFS.some(def => permValues[def.key] !== permissions[def.key])
    }, [phoneValue, deptValue, permValues, phone, departmentId, permissions])

    const hostels = departments.filter(d => d.isHostel)
    const otherDepts = departments.filter(d => !d.isHostel)

    async function patch(body: Record<string, unknown>) {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`/api/users/${supervisorId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.error || 'Update failed')
            }
            router.refresh()
            return true
        } catch (err: any) {
            setError(err.message || 'Update failed')
            return false
        } finally {
            setLoading(false)
        }
    }

    async function handleSave() {
        const ok = await patch({ phone: phoneValue || null, departmentId: deptValue || null, permissions: permValues })
        if (ok) {
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        }
    }

    async function handleConfirmedAction() {
        if (confirming === 'delete') {
            setLoading(true)
            setError('')
            try {
                const res = await fetch(`/api/users/${supervisorId}`, { method: 'DELETE' })
                if (!res.ok) {
                    const json = await res.json().catch(() => ({}))
                    throw new Error(json.error || 'Failed to delete')
                }
                router.push('/dashboard/admin/supervisors')
                router.refresh()
            } catch (err: any) {
                setError(err.message || 'Error deleting supervisor')
                setLoading(false)
            }
            return
        }
        const ok = await patch({ isActive: confirming === 'activate' })
        if (ok) setConfirming(null)
    }

    return (
        <div className="card">
            <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Assignment &amp; Permissions</h3>

            {error && <InlineBanner type="error" message={error} />}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Phone Number</label>
                    <input
                        value={phoneValue}
                        onChange={(e) => setPhoneValue(e.target.value)}
                        className="input"
                        placeholder="e.g. 0300-1234567"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Hostel / Department</label>
                    <select value={deptValue} onChange={(e) => setDeptValue(e.target.value)} className="input">
                        <option value="">Unassigned</option>
                        {hostels.length > 0 && (
                            <optgroup label="Hostels">
                                {hostels.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </optgroup>
                        )}
                        {otherDepts.length > 0 && (
                            <optgroup label="Departments">
                                {otherDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </optgroup>
                        )}
                    </select>
                </div>
            </div>

            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Action Permissions</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {PERMISSION_DEFS.map(def => (
                    <ToggleSwitch
                        key={def.key}
                        checked={permValues[def.key]}
                        onChange={(v) => setPermValues(p => ({ ...p, [def.key]: v }))}
                        label={def.label}
                        description={def.description}
                    />
                ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={handleSave} disabled={loading || !isDirty} className="btn btn-primary">
                    {loading ? 'Saving…' : 'Save Changes'}
                </button>
                {saved && <span style={{ color: '#22c55e', fontSize: '0.875rem' }}>Saved ✓</span>}
                {!saved && !isDirty && <span style={{ color: 'var(--muted-foreground)', fontSize: '0.8125rem' }}>No unsaved changes</span>}
                <button onClick={() => setConfirming(isActive ? 'suspend' : 'activate')} disabled={loading} className="btn btn-outline">
                    {isActive ? 'Suspend Account' : 'Activate Account'}
                </button>
                <button onClick={() => setConfirming('delete')} disabled={loading} className="btn" style={{ color: '#ef4444', border: '1px solid #ef4444', marginLeft: 'auto' }}>
                    Delete Supervisor
                </button>
            </div>

            {confirming && (
                <ConfirmModal
                    title={confirming === 'delete' ? 'Delete Supervisor' : confirming === 'suspend' ? 'Suspend Supervisor' : 'Activate Supervisor'}
                    message={
                        confirming === 'delete'
                            ? 'Permanently delete this supervisor account? This cannot be undone.'
                            : confirming === 'suspend'
                                ? 'They will not be able to log in until reactivated.'
                                : 'They will be able to log in again.'
                    }
                    confirmLabel={confirming === 'delete' ? 'Delete' : confirming === 'suspend' ? 'Suspend' : 'Activate'}
                    danger={confirming !== 'activate'}
                    loading={loading}
                    onConfirm={handleConfirmedAction}
                    onCancel={() => setConfirming(null)}
                />
            )}
        </div>
    )
}
