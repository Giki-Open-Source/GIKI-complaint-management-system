'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { OfficerPermissions } from '@/lib/permissions'

interface DepartmentOption {
    id: string
    name: string
    categoryLabel: string | null
}

interface ComplaintActionsProps {
    complaintId: string
    currentStatus: string
    isAssignedOfficer: boolean
    isAdmin: boolean
    isDeptOfficer: boolean
    isComplainant: boolean
    departments: DepartmentOption[]
    /** null means unrestricted (admin) -- otherwise the acting officer's own permission flags. */
    permissions: OfficerPermissions | null
}

export default function ComplaintActions({ complaintId, currentStatus, isAssignedOfficer, isAdmin, isDeptOfficer, isComplainant, departments, permissions }: ComplaintActionsProps) {
    const can = (key: keyof OfficerPermissions) => permissions === null || permissions[key]
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [showResolve, setShowResolve] = useState(false)
    const [showEscalate, setShowEscalate] = useState(false)
    const [showReject, setShowReject] = useState(false)
    const [showReroute, setShowReroute] = useState(false)
    const [showNotes, setShowNotes] = useState(false)
    const [proofFile, setProofFile] = useState<File | null>(null)
    const [rating, setRating] = useState(0)

    async function handleStatusChange(status: string, data: any = {}) {
        setLoading(true)
        try {
            const res = await fetch(`/api/complaints/${complaintId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, ...data }),
            })

            if (!res.ok) throw new Error('Failed to update status')

            router.refresh()
            setShowResolve(false)
            setShowEscalate(false)
            setShowReject(false)
        } catch (error) {
            alert('Error updating status')
        } finally {
            setLoading(false)
        }
    }

    async function handleReroute(newDeptId: string) {
        setLoading(true)
        try {
            const res = await fetch(`/api/complaints/${complaintId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignedDeptId: newDeptId }),
            })
            if (!res.ok) throw new Error('Failed to reroute')
            router.refresh()
            setShowReroute(false)
        } catch (error) {
            alert('Error rerouting complaint')
        } finally {
            setLoading(false)
        }
    }

    async function handleResolveSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const summary = (e.currentTarget.elements.namedItem('resolutionSummary') as HTMLTextAreaElement).value

        let resolutionProof
        if (proofFile) {
            const uploadFormData = new FormData()
            uploadFormData.append('file', proofFile)
            const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadFormData })
            if (!uploadRes.ok) {
                alert('Failed to upload proof photo')
                return
            }
            resolutionProof = await uploadRes.json()
        }

        handleStatusChange('RESOLVED', { resolutionSummary: summary, resolutionProof })
    }

    async function handleSaveNotes(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        const formData = new FormData(e.currentTarget)
        const internalNotes = formData.get('internalNotes') as string

        try {
            const res = await fetch(`/api/complaints/${complaintId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: currentStatus, internalNotes }),
            })
            if (!res.ok) throw new Error('Failed to save notes')
            router.refresh()
            setShowNotes(false)
        } catch (error) {
            alert('Error saving notes')
        } finally {
            setLoading(false)
        }
    }

    async function handleRespond(action: 'close' | 'reopen') {
        if (action === 'close' && !rating) {
            alert('Please select a rating')
            return
        }
        setLoading(true)
        try {
            const res = await fetch(`/api/complaints/${complaintId}/respond`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, rating: action === 'close' ? rating : undefined }),
            })
            if (!res.ok) throw new Error('Failed to submit response')
            router.refresh()
        } catch (error) {
            alert('Error submitting response')
        } finally {
            setLoading(false)
        }
    }

    const isOfficerOrAdmin = isDeptOfficer || isAssignedOfficer || isAdmin

    return (
        <>
            {isOfficerOrAdmin && (
                <div className="card" style={{ marginTop: '1.5rem', borderTop: '4px solid var(--accent)' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Officer Actions</h3>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {currentStatus === 'SUBMITTED' && (
                            <>
                                {can('canClaim') && (
                                    <button
                                        onClick={() => handleStatusChange('IN_PROGRESS')}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        Claim Complaint
                                    </button>
                                )}
                                {can('canReject') && (
                                    <button
                                        onClick={() => setShowReject(!showReject)}
                                        disabled={loading}
                                        className="btn btn-outline"
                                    >
                                        Reject
                                    </button>
                                )}
                                {can('canReroute') && (
                                    <button
                                        onClick={() => setShowReroute(!showReroute)}
                                        disabled={loading}
                                        className="btn btn-outline"
                                    >
                                        Reroute
                                    </button>
                                )}
                            </>
                        )}

                        {(currentStatus === 'IN_PROGRESS' || currentStatus === 'ESCALATED') && (
                            <>
                                {can('canResolve') && (
                                    <button
                                        onClick={() => setShowResolve(!showResolve)}
                                        disabled={loading}
                                        className="btn"
                                        style={{ backgroundColor: '#22c55e', color: 'white' }}
                                    >
                                        Resolve
                                    </button>
                                )}
                                {can('canEscalate') && (
                                    <button
                                        onClick={() => setShowEscalate(!showEscalate)}
                                        disabled={loading}
                                        className="btn"
                                        style={{ backgroundColor: '#ef4444', color: 'white' }}
                                    >
                                        Escalate
                                    </button>
                                )}
                            </>
                        )}

                        <button
                            onClick={() => setShowNotes(!showNotes)}
                            className="btn btn-outline"
                        >
                            {showNotes ? 'Hide Notes' : 'Internal Notes'}
                        </button>
                    </div>

                    {showReject && (
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            const reason = (e.currentTarget.elements.namedItem('rejectionReason') as HTMLTextAreaElement).value
                            handleStatusChange('REJECTED', { rejectionReason: reason })
                        }} style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Rejection Reason (Required)</label>
                            <textarea name="rejectionReason" required className="input" rows={3} placeholder="Why is this invalid or a duplicate?" />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" disabled={loading} className="btn" style={{ backgroundColor: '#64748b', color: 'white' }}>Confirm Rejection</button>
                                <button type="button" onClick={() => setShowReject(false)} className="btn btn-outline">Cancel</button>
                            </div>
                        </form>
                    )}

                    {showReroute && (
                        <div style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Reroute to Department</label>
                            <select
                                className="input"
                                defaultValue=""
                                onChange={(e) => e.target.value && handleReroute(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">Select correct department...</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.categoryLabel || dept.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {showResolve && (
                        <form onSubmit={handleResolveSubmit} style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Resolution Summary (Required)</label>
                            <textarea name="resolutionSummary" required className="input" rows={3} placeholder="Describe how the issue was resolved..." />
                            <label style={{ display: 'block', margin: '0.75rem 0 0.5rem', fontWeight: '500' }}>Proof Photo (optional)</label>
                            <input type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] ?? null)} className="input" />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" disabled={loading} className="btn btn-primary">Confirm Resolution</button>
                                <button type="button" onClick={() => setShowResolve(false)} className="btn btn-outline">Cancel</button>
                            </div>
                        </form>
                    )}

                    {showEscalate && (
                        <form onSubmit={(e) => {
                            e.preventDefault()
                            const reason = (e.currentTarget.elements.namedItem('escalationReason') as HTMLTextAreaElement).value
                            handleStatusChange('ESCALATED', { escalationReason: reason })
                        }} style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Escalation Reason (Required)</label>
                            <textarea name="escalationReason" required className="input" rows={3} placeholder="Why is this being escalated?" />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" disabled={loading} className="btn" style={{ backgroundColor: '#ef4444', color: 'white' }}>Confirm Escalation</button>
                                <button type="button" onClick={() => setShowEscalate(false)} className="btn btn-outline">Cancel</button>
                            </div>
                        </form>
                    )}

                    {showNotes && (
                        <form onSubmit={handleSaveNotes} style={{ marginTop: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Internal Notes (Visible only to Officers/Admin)</label>
                            <textarea name="internalNotes" className="input" rows={3} placeholder="Add internal notes..." />
                            <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                                <button type="submit" disabled={loading} className="btn btn-primary">Save Notes</button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {isComplainant && currentStatus === 'RESOLVED' && (
                <div className="card" style={{ marginTop: '1.5rem', borderTop: '4px solid #22c55e' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '1rem' }}>Are you satisfied with this resolution?</h3>
                    <div style={{ marginBottom: '1rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                style={{ fontSize: '1.5rem', color: star <= rating ? '#eab308' : 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                {star <= rating ? '★' : '☆'}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => handleRespond('close')} disabled={loading} className="btn btn-primary">
                            Confirm & Close
                        </button>
                        <button onClick={() => handleRespond('reopen')} disabled={loading} className="btn" style={{ backgroundColor: '#ef4444', color: 'white' }}>
                            Not Fixed — Reopen
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
