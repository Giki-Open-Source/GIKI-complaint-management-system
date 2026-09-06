import bcrypt from 'bcryptjs'
import { query } from './db'
import { verifyToken } from './jwt'

export * from './jwt'

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash)
}

export async function getUserFromToken(token: string) {
    const payload = verifyToken(token)
    if (!payload) return null

    const { rows } = await query(
        'SELECT id, email, role, name, "departmentId", phone, "isActive", permissions FROM "User" WHERE id = $1',
        [payload.userId]
    )

    return rows[0] ?? null
}

