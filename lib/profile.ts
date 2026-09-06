export interface ProfileFields {
    registrationNumber: string | null
    hostelName: string | null
    roomNumber: string | null
    major: string | null
}

// Field labels adapt per role even though they're the same underlying columns
// (e.g. hostelName reads as "Building" for faculty/staff, not "Hostel").
export function getProfileFieldLabels(role: string) {
    if (role === 'STUDENT') {
        return {
            registrationNumber: 'Registration Number',
            hostelName: 'Hostel Name',
            roomNumber: 'Room Number',
            major: 'Major / Field of Study',
        }
    }
    return {
        registrationNumber: 'Employee Number',
        hostelName: 'Building',
        roomNumber: 'Office Number',
        major: 'Department / Subject Area',
    }
}

// Which fields must be filled in before that role can submit a complaint.
export function getRequiredProfileFields(role: string): (keyof ProfileFields)[] {
    if (role === 'STUDENT') {
        return ['registrationNumber', 'hostelName', 'roomNumber']
    }
    if (role === 'FACULTY' || role === 'STAFF') {
        return ['registrationNumber', 'major']
    }
    return []
}

export function isProfileComplete(user: ProfileFields & { role: string }): boolean {
    return getRequiredProfileFields(user.role).every(field => !!user[field])
}

export function getMissingProfileFields(user: ProfileFields & { role: string }): (keyof ProfileFields)[] {
    return getRequiredProfileFields(user.role).filter(field => !user[field])
}
