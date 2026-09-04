'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default function RegisterPage() {
    const [step, setStep] = useState<'form' | 'otp'>('form')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('STUDENT')
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [info, setInfo] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role }),
            })

            const data = await res.json()

            if (res.ok) {
                setStep('otp')
            } else {
                if (Array.isArray(data.error)) {
                    // Handle Zod error array
                    setError(data.error.map((e: any) => e.message).join(', '))
                } else {
                    setError(data.error || 'Registration failed')
                }
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            })

            if (res.ok) {
                router.push('/dashboard')
                router.refresh()
            } else {
                const data = await res.json()
                setError(data.error || 'Verification failed')
                setLoading(false)
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
            setLoading(false)
        }
    }

    const handleResend = async () => {
        setError('')
        setInfo('')
        setLoading(true)

        try {
            const res = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            const data = await res.json()

            if (res.ok) {
                setInfo(data.message)
            } else {
                setError(data.error || 'Failed to resend code')
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <Image
                        src="/giki-logo.png"
                        alt="GIKI logo"
                        width={48}
                        height={48}
                        style={{ borderRadius: '10px', marginBottom: '1rem' }}
                    />
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '1.25rem', color: 'var(--muted-foreground)' }}>GIKomplain</div>
                    {step === 'form' ? (
                        <>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Create an account</h1>
                            <p className="text-muted text-sm">Enter your details to get started</p>
                        </>
                    ) : (
                        <>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Verify your email</h1>
                            <p className="text-muted text-sm">Enter the 6-digit code sent to {email}</p>
                        </>
                    )}
                </div>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                        {error}
                    </div>
                )}

                {info && (
                    <div style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: '#16a34a',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius)',
                        marginBottom: '1.5rem',
                        fontSize: '0.875rem',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                    }}>
                        {info}
                    </div>
                )}

                {step === 'form' ? (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label htmlFor="name" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Full Name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="input"
                                placeholder="John Doe"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="input"
                                placeholder="name@giki.edu.pk"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="input"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <label htmlFor="role" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Role</label>
                            <select
                                id="role"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                className="input"
                            >
                                <option value="STUDENT">Student</option>
                                <option value="FACULTY">Faculty</option>
                                <option value="STAFF">Staff</option>
                                <option value="DEPT_OFFICER">Department Officer</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ marginTop: '0.5rem', width: '100%' }}
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label htmlFor="code" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem', color: 'var(--foreground)' }}>Verification Code</label>
                            <input
                                id="code"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                                required
                                className="input"
                                placeholder="123456"
                                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                            disabled={loading || code.length !== 6}
                        >
                            {loading ? 'Verifying...' : 'Verify & Continue'}
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline"
                            style={{ width: '100%' }}
                            onClick={handleResend}
                            disabled={loading}
                        >
                            Resend code
                        </button>
                    </form>
                )}

                <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                    Already have an account? <Link href="/login" style={{ color: 'var(--foreground)', textDecoration: 'underline', textUnderlineOffset: '4px' }}>Login</Link>
                </div>
            </div>
        </div>
    )
}
