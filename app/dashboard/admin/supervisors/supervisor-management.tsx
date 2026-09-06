'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { PERMISSION_DEFS, DEFAULT_PERMISSIONS } from '@/lib/permissions'
import { ToggleSwitch, ConfirmModal, InlineBanner } from './ui'
import ExportButtons from '../export-buttons'

interface Supervisor {
    id: string
    name: string
    email: string
    phone: string | null
    isActive: boolean
    emailVerified: string | null
    createdAt: string
    deptId: string | null
    deptName: string | null
    totalAssigned: number
    openNow: number
    overdueNow: number
    resolvedByThem: number
    avgRating: string | null
}

interface Department {
    id: string
    name: string
    isHostel: boolean
}

export default function SupervisorManagement({ initialSupervisors, departments }: { initialSupervisors: Supervisor[]; departments: Department[] }) {
    const router = useRouter()
    const [showAddModal, setShowAddModal] = useState(false)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [deptFilter, setDeptFilter] = useState('')
    const [pendingAction, setPendingAction] = useState<{ type: 'suspend' | 'activate' | 'delete'; supervisor: Supervisor } | null>(null)

    const totalSupervisors = initialSupervisors.length

    const assignedDepartments = useMemo(
        () => departments.filter(d => initialSupervisors.some(s => s.deptId === d.id)),
        [departments, initialSupervisors]
    )

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return initialSupervisors.filter(s => {
            if (q && !s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
            if (deptFilter && s.deptId !== deptFilter) return false
            return true
        })
    }, [initialSupervisors, search, deptFilter])

    async function runAction() {
        if (!pendingAction) return
        const { type, supervisor } = pendingAction
        setLoadingId(supervisor.id)
        setError('')
        try {
            const res = type === 'delete'
                ? await fetch(`/api/users/${supervisor.id}`, { method: 'DELETE' })
                : await fetch(`/api/users/${supervisor.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ isActive: type === 'activate' }),
                })
            if (!res.ok) {
                const json = await res.json().catch(() => ({}))
                throw new Error(json.error || 'Action failed')
            }
            router.refresh()
            setPendingAction(null)
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div>
            {error && <InlineBanner type="error" message={error} />}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="input"
                        style={{ paddingLeft: '2.25rem' }}
                    />
                </div>
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input" style={{ width: 'auto' }}>
                    <option value="">All Hostels / Departments</option>
                    {assignedDepartments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <ExportButtons
                        endpoint="/api/export/supervisors"
                        params={{ q: search.trim() || undefined, dept: deptFilter || undefined }}
                    />
                    <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
                        Add Supervisor
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                {['Name', 'Contact', 'Hostel / Department', 'Assigned', 'Open', 'Resolved', 'Avg Rating', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '0.5rem 0.75rem', color: 'var(--muted-foreground)', fontWeight: '500', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                                        {initialSupervisors.length === 0
                                            ? <>No supervisors yet. Click &quot;Add Supervisor&quot; to create one.</>
                                            : <>No supervisors match your search/filters.</>}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(s => (
                                    <tr
                                        key={s.id}
                                        onClick={() => router.push(`/dashboard/admin/supervisors/${s.id}`)}
                                        style={{
                                            borderBottom: '1px solid var(--border)',
                                            opacity: s.isActive ? 1 : 0.5,
                                            cursor: 'pointer',
                                            borderLeft: s.overdueNow > 0 ? '3px solid #eab308' : '3px solid transparent',
                                        }}
                                    >
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <Link
                                                href={`/dashboard/admin/supervisors/${s.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ fontWeight: '500', color: 'var(--foreground)', textDecoration: 'underline' }}
                                            >
                                                {s.name}
                                            </Link>
                                            {!s.emailVerified && (
                                                <div style={{ fontSize: '0.6875rem', color: '#eab308' }}>Not verified</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem', color: 'var(--muted-foreground)' }}>
                                            <div>{s.email}</div>
                                            <div>{s.phone || '—'}</div>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{s.deptName || <span style={{ color: '#eab308' }}>Unassigned</span>}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{s.totalAssigned}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            {s.openNow}
                                            {s.overdueNow > 0 && <span style={{ marginLeft: '0.375rem', fontSize: '0.6875rem', fontWeight: 700, color: '#eab308' }}>({s.overdueNow} overdue)</span>}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{s.resolvedByThem}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>{s.avgRating ? `★ ${s.avgRating}` : '—'}</td>
                                        <td style={{ padding: '0.5rem 0.75rem' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => setPendingAction({ type: s.isActive ? 'suspend' : 'activate', supervisor: s })}
                                                    disabled={loadingId === s.id}
                                                    className="btn btn-outline"
                                                    style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }}
                                                >
                                                    {s.isActive ? 'Suspend' : 'Activate'}
                                                </button>
                                                <button
                                                    onClick={() => setPendingAction({ type: 'delete', supervisor: s })}
                                                    disabled={loadingId === s.id}
                                                    className="btn"
                                                    style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem', color: 'var(--foreground)', border: '1px solid var(--foreground)' }}
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

            {filtered.length > 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.5rem' }}>
                    Showing {filtered.length} of {totalSupervisors} supervisors
                </div>
            )}

            {showAddModal && (
                <AddSupervisorModal onClose={() => setShowAddModal(false)} departments={departments} />
            )}

            {pendingAction && (
                <ConfirmModal
                    title={
                        pendingAction.type === 'delete' ? 'Delete Supervisor'
                            : pendingAction.type === 'suspend' ? 'Suspend Supervisor'
                                : 'Activate Supervisor'
                    }
                    message={
                        pendingAction.type === 'delete'
                            ? `Permanently delete ${pendingAction.supervisor.name}'s account? This cannot be undone.`
                            : pendingAction.type === 'suspend'
                                ? `${pendingAction.supervisor.name} will not be able to log in until reactivated.`
                                : `${pendingAction.supervisor.name} will be able to log in again.`
                    }
                    confirmLabel={pendingAction.type === 'delete' ? 'Delete' : pendingAction.type === 'suspend' ? 'Suspend' : 'Activate'}
                    danger={pendingAction.type !== 'activate'}
                    loading={loadingId === pendingAction.supervisor.id}
                    onConfirm={runAction}
                    onCancel={() => setPendingAction(null)}
                />
            )}
        </div>
    )
}

function AddSupervisorModal({ onClose, departments }: { onClose: () => void; departments: Department[] }) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [permissions, setPermissions] = useState({ ...DEFAULT_PERMISSIONS })

    const hostels = departments.filter(d => d.isHostel)
    const otherDepts = departments.filter(d => !d.isHostel)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const data = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            phone: formData.get('phone') || undefined,
            departmentId: formData.get('departmentId') || undefined,
            role: 'DEPT_OFFICER',
            permissions,
        }

        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const json = await res.json()
                throw new Error(typeof json.error === 'string' ? json.error : 'Failed to create supervisor')
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Add Supervisor</h2>
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                    The account is created already verified and can log in immediately with the password below.
                </p>

                {error && <InlineBanner type="error" message={error} />}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Full Name</label>
                        <input name="name" required className="input" placeholder="e.g. Muhammad Asif" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Email</label>
                        <input name="email" type="email" required className="input" placeholder="supervisor@giki.edu.pk" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Phone Number</label>
                        <input name="phone" type="tel" className="input" placeholder="e.g. 0300-1234567" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Temporary Password</label>
                        <input name="password" type="password" required minLength={6} className="input" placeholder="At least 6 characters" />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Hostel / Department</label>
                        <select name="departmentId" required className="input" defaultValue="">
                            <option value="" disabled>Select a hostel or department…</option>
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

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Permissions</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {PERMISSION_DEFS.map(def => (
                                <ToggleSwitch
                                    key={def.key}
                                    checked={permissions[def.key]}
                                    onChange={(v) => setPermissions(p => ({ ...p, [def.key]: v }))}
                                    label={def.label}
                                    description={def.description}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                            {loading ? 'Creating…' : 'Create Supervisor'}
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
