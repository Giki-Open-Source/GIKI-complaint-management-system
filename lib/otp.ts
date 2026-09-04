import crypto from 'crypto'

export const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function generateOtp(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}
