'use server'

import { query } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function assignComplaint(complaintId: string, type: 'department' | 'officer', id: string) {
    try {
        const column = type === 'department' ? 'assignedDeptId' : 'assignedOfficerId'

        await query(`UPDATE "Complaint" SET "${column}" = $1 WHERE id = $2`, [id, complaintId])

        revalidatePath('/dashboard/admin')
        return { success: true }
    } catch (error) {
        console.error('Failed to assign complaint:', error)
        return { success: false, error: 'Failed to assign complaint' }
    }
}
