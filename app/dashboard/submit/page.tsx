'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

interface DepartmentOption {
    id: string
    categoryLabel: string | null
    name: string
}

export default function SubmitComplaintPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [departments, setDepartments] = useState<DepartmentOption[]>([])

    useEffect(() => {
        fetch('/api/departments')
            .then(res => res.json())
            .then(data => setDepartments(data.departments || []))
    }, [])

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const title = formData.get('title') as string
        const description = formData.get('description') as string
        const departmentId = formData.get('departmentId') as string
        const subcategory = formData.get('subcategory') as string

        try {
            // Upload files first
            const uploadedAttachments = []
            for (const file of files) {
                const uploadFormData = new FormData()
                uploadFormData.append('file', file)

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: uploadFormData
                })

                if (!uploadRes.ok) throw new Error('File upload failed')
                const data = await uploadRes.json()
                uploadedAttachments.push(data)
            }

            // Submit complaint
            const res = await fetch('/api/complaints', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title,
                    description,
                    departmentId,
                    subcategory: subcategory || undefined,
                    attachments: uploadedAttachments
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to submit complaint')
            }

            router.push('/dashboard/my-complaints')
            router.refresh()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files)
            if (files.length + newFiles.length > 3) {
                setError('Maximum 3 files allowed')
                return
            }

            // Check total size (5MB = 5 * 1024 * 1024 bytes)
            const totalSize = [...files, ...newFiles].reduce((acc, file) => acc + file.size, 0)
            if (totalSize > 5 * 1024 * 1024) {
                setError('Total file size exceeds 5MB')
                return
            }

            setFiles([...files, ...newFiles])
            setError('')
        }
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Submit a Complaint</h1>

            <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {error && (
                    <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '0.5rem' }}>
                        {error}
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Title (Min 5 chars)</label>
                    <input name="title" required minLength={5} className="input" placeholder="Brief summary of the issue" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Category</label>
                    <select name="departmentId" required className="input">
                        <option value="">Select a category</option>
                        {departments.map(dept => (
                            <option key={dept.id} value={dept.id}>{dept.categoryLabel || dept.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Additional Detail (optional)</label>
                    <input name="subcategory" className="input" placeholder="e.g. Electrical - fan not working" />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Description (Min 10 chars)</label>
                    <textarea name="description" required minLength={10} className="input" rows={5} placeholder="Detailed description..." />
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Attachments (Max 3, Total 5MB)</label>
                    <input type="file" multiple onChange={handleFileChange} className="input" accept="image/*,.pdf,.doc,.docx" />
                    {files.length > 0 && (
                        <ul style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
                            {files.map((f, i) => <li key={i}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>)}
                        </ul>
                    )}
                </div>

                <button type="submit" disabled={loading} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
                    {loading ? 'Submitting...' : 'Submit Complaint'}
                </button>
            </form>
        </div>
    )
}
