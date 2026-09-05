'use client'

import { useRouter, useSearchParams } from 'next/navigation'

export default function DashboardControls() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const currentStatus = searchParams.get('status') || 'ALL'
    const currentSort = searchParams.get('sort') || 'priority'

    function handleFilter(status: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (status === 'ALL') params.delete('status')
        else params.set('status', status)
        router.push(`?${params.toString()}`)
    }

    function handleSort(sort: string) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('sort', sort)
        router.push(`?${params.toString()}`)
    }

    return (
        <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontWeight: '500', color: 'var(--muted-foreground)' }}>Filter by:</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['ALL', 'SUBMITTED', 'IN_PROGRESS', 'ESCALATED', 'RESOLVED', 'REJECTED', 'CLOSED'].map((status) => (
                        <button
                            key={status}
                            onClick={() => handleFilter(status)}
                            className={`btn ${currentStatus === status ? 'btn-primary' : 'btn-outline'}`}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px' }}
                        >
                            {status === 'ALL' ? 'All' : status.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontWeight: '500', color: 'var(--muted-foreground)' }}>Sort by:</span>
                <select
                    value={currentSort}
                    onChange={(e) => handleSort(e.target.value)}
                    className="input"
                    style={{ width: 'auto', padding: '0.25rem 2rem 0.25rem 0.75rem' }}
                >
                    <option value="priority">Priority (Recommended)</option>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>
        </div>
    )
}
