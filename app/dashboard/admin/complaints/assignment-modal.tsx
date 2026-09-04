'use client'

import { useState } from 'react'
import { assignComplaint } from './actions'
import { User, Department } from '@/lib/types'
import { UserPlus, X } from 'lucide-react'

interface AssignmentModalProps {
    complaintId: string
    departments: Department[]
    officers: User[]
    currentDeptId?: string | null
    currentOfficerId?: string | null
}

export default function ComplaintAssignment({ complaintId, departments, officers, currentDeptId, currentOfficerId }: AssignmentModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleAssign = async (type: 'department' | 'officer', id: string) => {
        setLoading(true)
        await assignComplaint(complaintId, type, id)
        setLoading(false)
        setIsOpen(false)
    }

    if (!isOpen) {
        return (
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setIsOpen(true)
                }}
                className="btn btn-sm btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
                <UserPlus size={16} />
                Assign
            </button>
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={(e) => {
            e.preventDefault()
            setIsOpen(false)
        }}>
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', width: '400px', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>Assign Complaint</h3>
                    <button onClick={() => setIsOpen(false)}><X size={20} /></button>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--muted-foreground)' }}>Assign to Department</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {departments.map(dept => (
                            <button
                                key={dept.id}
                                onClick={() => handleAssign('department', dept.id)}
                                disabled={loading || currentDeptId === dept.id}
                                style={{
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '9999px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: currentDeptId === dept.id ? '#eff6ff' : 'white',
                                    color: currentDeptId === dept.id ? '#2563eb' : 'inherit',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.875rem'
                                }}
                            >
                                {dept.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--muted-foreground)' }}>Assign to Officer</h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {officers.map(officer => (
                            <button
                                key={officer.id}
                                onClick={() => handleAssign('officer', officer.id)}
                                disabled={loading || currentOfficerId === officer.id}
                                style={{
                                    textAlign: 'left',
                                    padding: '0.5rem',
                                    borderRadius: '0.25rem',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: currentOfficerId === officer.id ? '#eff6ff' : 'white',
                                    color: currentOfficerId === officer.id ? '#2563eb' : 'inherit',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}
                            >
                                <span>{officer.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{officer.role}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
