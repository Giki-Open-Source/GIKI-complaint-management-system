// Per-officer action permissions. Admins are never gated by these — only
// DEPT_OFFICER accounts can have individual actions restricted by an admin.
export interface OfficerPermissions {
    canClaim: boolean
    canResolve: boolean
    canEscalate: boolean
    canReject: boolean
    canReroute: boolean
}

export const DEFAULT_PERMISSIONS: OfficerPermissions = {
    canClaim: true,
    canResolve: true,
    canEscalate: true,
    canReject: true,
    canReroute: true,
}

export const PERMISSION_DEFS: { key: keyof OfficerPermissions; label: string; description: string }[] = [
    { key: 'canClaim', label: 'Claim Complaints', description: 'Take ownership of a newly submitted complaint.' },
    { key: 'canResolve', label: 'Resolve Complaints', description: 'Mark a claimed complaint as resolved.' },
    { key: 'canEscalate', label: 'Escalate Complaints', description: 'Escalate a complaint to higher authority.' },
    { key: 'canReject', label: 'Reject Complaints', description: 'Reject an unclaimed complaint as invalid or duplicate.' },
    { key: 'canReroute', label: 'Reroute Complaints', description: 'Send an unclaimed complaint to a different department.' },
]

export function normalizePermissions(value: unknown): OfficerPermissions {
    const source = (value && typeof value === 'object') ? value as Record<string, unknown> : {}
    const result = { ...DEFAULT_PERMISSIONS }
    for (const def of PERMISSION_DEFS) {
        if (typeof source[def.key] === 'boolean') result[def.key] = source[def.key] as boolean
    }
    return result
}
