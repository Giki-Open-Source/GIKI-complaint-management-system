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
    registrationNumber: string | null
    hostelName: string | null
    roomNumber: string | null
    major: string | null
    gender: string | null
}

export type SafeUser = Omit<User, 'password'>

export interface Department {
    id: string
    name: string
    categoryLabel: string | null
    defaultPriority: string
    slaHours: number
    escalationContactName: string | null
    escalationContactTitle: string | null
}

export interface Complaint {
    id: string
    title: string
    description: string
    category: string
    subcategory: string | null
    status: string
    priority: string
    complainantId: string
    assignedDeptId: string | null
    assignedOfficerId: string | null
    resolutionSummary: string | null
    internalNotes: string | null
    rating: number | null
    closedAt: Date | null
    rejectionReason: string | null
    reopenCount: number
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
