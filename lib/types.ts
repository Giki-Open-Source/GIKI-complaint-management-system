export interface User {
    id: string
    email: string
    password: string
    name: string | null
    role: string
    departmentId: string | null
    createdAt: Date
    updatedAt: Date
    emailVerified: Date | null
    otpCode: string | null
    otpExpiresAt: Date | null
}

export type SafeUser = Omit<User, 'password'>

export interface Department {
    id: string
    name: string
}

export interface Complaint {
    id: string
    title: string
    description: string
    category: string
    status: string
    complainantId: string
    assignedDeptId: string | null
    assignedOfficerId: string | null
    resolutionSummary: string | null
    internalNotes: string | null
    createdAt: Date
    updatedAt: Date
}

export interface Attachment {
    id: string
    url: string
    name: string
    size: number
    complaintId: string
}

export interface AuditLog {
    id: string
    action: string
    details: string | null
    actorId: string
    targetId: string | null
    complaintId: string | null
    createdAt: Date
}

export interface Comment {
    id: string
    content: string
    complaintId: string
    authorId: string
    createdAt: Date
    updatedAt: Date
}
