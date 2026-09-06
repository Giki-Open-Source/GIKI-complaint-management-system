'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Comment {
    id: string
    content: string
    createdAt: string
    author: {
        name: string | null
        role: string
    }
}

interface CommentsSectionProps {
    complaintId: string
    initialComments: Comment[]
    currentUserEmail: string
}

export default function CommentsSection({ complaintId, initialComments, currentUserEmail }: CommentsSectionProps) {
    const router = useRouter()
    const [comments, setComments] = useState<Comment[]>(initialComments)
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!newComment.trim()) return

        setLoading(true)
        try {
            const res = await fetch(`/api/complaints/${complaintId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newComment }),
            })

            if (!res.ok) throw new Error('Failed to post comment')

            const data = await res.json()
            setComments([...comments, data.comment])
            setNewComment('')
            router.refresh()
        } catch (error) {
            alert('Error posting comment')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Discussion Thread</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {comments.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted-foreground)', border: '1px dashed var(--border)', borderRadius: 0 }}>
                        No comments yet. Start the conversation.
                    </div>
                ) : (
                    comments.map((comment) => (
                        <div key={comment.id} className="card" style={{ padding: '1rem', backgroundColor: 'var(--secondary)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.925rem' }}>{comment.author.name || 'Unknown'}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: 0,
                                        backgroundColor: comment.author.role === 'STUDENT' ? 'var(--muted)' : 'var(--accent)',
                                        color: comment.author.role === 'STUDENT' ? 'var(--muted-foreground)' : 'var(--accent-foreground)'
                                    }}>
                                        {comment.author.role}
                                    </span>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                    {new Date(comment.createdAt).toLocaleString()}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.925rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="card" style={{ padding: '1rem' }}>
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your message here..."
                    className="input"
                    rows={3}
                    required
                    style={{ marginBottom: '0.75rem', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={loading || !newComment.trim()}
                        className="btn btn-primary"
                    >
                        {loading ? 'Posting...' : 'Post Comment'}
                    </button>
                </div>
            </form>
        </div>
    )
}
