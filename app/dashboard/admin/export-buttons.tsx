'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'

/**
 * Download buttons for a filtered listing. `params` carries the caller's active
 * filters through to the export route so the file matches what's on screen.
 */
export default function ExportButtons({ endpoint, params }: { endpoint: string; params: Record<string, string | undefined> }) {
    const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null)
    const [error, setError] = useState('')

    async function download(format: 'csv' | 'pdf') {
        setBusy(format)
        setError('')
        try {
            const search = new URLSearchParams()
            for (const [key, value] of Object.entries(params)) {
                if (value) search.set(key, value)
            }
            search.set('format', format)

            const res = await fetch(`${endpoint}?${search.toString()}`)
            if (!res.ok) throw new Error(`Export failed (${res.status})`)

            const blob = await res.blob()
            // Prefer the server's filename so the timestamp matches generation time.
            const disposition = res.headers.get('Content-Disposition') || ''
            const match = disposition.match(/filename="([^"]+)"/)
            const filename = match?.[1] || `export.${format}`

            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err: any) {
            setError(err.message || 'Export failed')
        } finally {
            setBusy(null)
        }
    }

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {error && <span style={{ fontSize: '0.75rem', color: '#eab308' }}>{error}</span>}
            <button
                type="button"
                onClick={() => download('csv')}
                disabled={busy !== null}
                className="btn btn-outline"
                style={{ gap: '0.5rem' }}
            >
                <Download size={16} />
                {busy === 'csv' ? 'Preparing…' : 'CSV'}
            </button>
            <button
                type="button"
                onClick={() => download('pdf')}
                disabled={busy !== null}
                className="btn btn-outline"
                style={{ gap: '0.5rem' }}
            >
                <Download size={16} />
                {busy === 'pdf' ? 'Preparing…' : 'PDF'}
            </button>
        </div>
    )
}
