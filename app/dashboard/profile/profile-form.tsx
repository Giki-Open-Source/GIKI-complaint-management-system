'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getProfileFieldLabels, getRequiredProfileFields } from '@/lib/profile'

interface Profile {
    id: string
    name: string
    email: string
    role: string
    registrationNumber: string | null
    hostelName: string | null
    roomNumber: string | null
    major: string | null
    gender: string | null
}

export default function ProfileForm({ profile }: { profile: Profile }) {
    const router = useRouter()
    const labels = getProfileFieldLabels(profile.role)
    const required = getRequiredProfileFields(profile.role)

    const [registrationNumber, setRegistrationNumber] = useState(profile.registrationNumber || '')
    const [hostelName, setHostelName] = useState(profile.hostelName || '')
    const [roomNumber, setRoomNumber] = useState(profile.roomNumber || '')
    const [major, setMajor] = useState(profile.major || '')
    const [gender, setGender] = useState(profile.gender || '')
    const [hostels, setHostels] = useState<{ id: string, categoryLabel: string | null, name: string }[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => {
        fetch('/api/departments')
            .then(res => res.json())
            .then(data => setHostels((data.departments || []).filter((d: any) => d.isHostel)))
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/users/me', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registrationNumber, hostelName, roomNumber, major, gender: gender || undefined }),
            })
            if (!res.ok) throw new Error('Failed to save profile')
            setSuccess('Profile saved.')
            router.refresh()
        } catch (err) {
            setError('Failed to save profile. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                    {success}
                </div>
            )}

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Name</label>
                <input className="input" value={profile.name} disabled />
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Email</label>
                <input className="input" value={profile.email} disabled />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>Gender</label>
                <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                </select>
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    {labels.registrationNumber}{required.includes('registrationNumber') && ' (Required)'}
                </label>
                <input
                    className="input"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    required={required.includes('registrationNumber')}
                />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    {labels.hostelName}{required.includes('hostelName') && ' (Required)'}
                </label>
                <select
                    className="input"
                    value={hostelName}
                    onChange={(e) => setHostelName(e.target.value)}
                    required={required.includes('hostelName')}
                >
                    <option value="">{required.includes('hostelName') ? 'Select your hostel' : 'Not applicable'}</option>
                    {hostels.map(h => (
                        <option key={h.id} value={h.categoryLabel || h.name}>{h.categoryLabel || h.name}</option>
                    ))}
                </select>
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    {labels.roomNumber}{required.includes('roomNumber') && ' (Required)'}
                </label>
                <input
                    className="input"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    required={required.includes('roomNumber')}
                />
            </div>

            <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.875rem' }}>
                    {labels.major}{required.includes('major') && ' (Required)'}
                </label>
                <input
                    className="input"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    required={required.includes('major')}
                />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                {loading ? 'Saving...' : 'Save Profile'}
            </button>
        </form>
    )
}
