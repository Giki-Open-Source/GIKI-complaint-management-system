import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'

export async function sendOtpEmail(to: string, code: string) {
    const { error } = await resend.emails.send({
        from: FROM,
        to,
        subject: 'Your GIKomplain verification code',
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="margin-bottom: 0.5rem;">Verify your email</h2>
                <p style="color: #555;">Use the code below to verify your GIKomplain account. It expires in 10 minutes.</p>
                <div style="font-size: 2rem; font-weight: 700; letter-spacing: 0.5rem; text-align: center; padding: 1rem; background: #f4f4f5; border-radius: 8px; margin: 1.5rem 0;">
                    ${code}
                </div>
                <p style="color: #999; font-size: 0.875rem;">If you didn't request this, you can safely ignore this email.</p>
            </div>
        `,
    })

    if (error) {
        throw new Error(`Resend failed to send OTP email: ${error.message}`)
    }
}
