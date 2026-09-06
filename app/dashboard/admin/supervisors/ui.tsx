'use client'

// Small shared UI pieces for the Supervisors module -- kept local rather than
// global since the rest of the app doesn't have a shared component layer yet.

export function ToggleSwitch({ checked, onChange, label, description }: {
    checked: boolean
    onChange: (value: boolean) => void
    label: string
    description?: string
}) {
    return (
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.625rem', backgroundColor: 'var(--secondary)', borderRadius: 'var(--radius)' }}>
            <span style={{ position: 'relative', flexShrink: 0, width: '36px', height: '20px', marginTop: '0.15rem' }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer', zIndex: 1 }}
                />
                <span style={{ position: 'absolute', inset: 0, borderRadius: '9999px', backgroundColor: checked ? '#22c55e' : 'var(--border)', transition: 'background-color 0.15s' }} />
                <span style={{ position: 'absolute', top: '2px', left: checked ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.15s' }} />
            </span>
            <span>
                <strong style={{ fontSize: '0.8125rem' }}>{label}</strong>
                {description && <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{description}</div>}
            </span>
        </label>
    )
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onCancel }: {
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    loading?: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    return (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>{message}</p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="btn"
                        style={{ flex: 1, backgroundColor: danger ? '#ef4444' : 'var(--primary)', color: danger ? 'white' : 'var(--primary-foreground)' }}
                    >
                        {loading ? 'Please wait…' : confirmLabel}
                    </button>
                    <button onClick={onCancel} disabled={loading} className="btn btn-outline" style={{ flex: 1 }}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}

export function InlineBanner({ type, message }: { type: 'error' | 'success'; message: string }) {
    return (
        <div style={{
            padding: '0.625rem 0.875rem',
            borderRadius: 'var(--radius)',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            backgroundColor: type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
            color: type === 'error' ? '#ef4444' : '#22c55e',
        }}>
            {message}
        </div>
    )
}
