import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
const LOGO_URL = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/giki-logo.png`
    : 'https://www.awssbggiki.app/giki-logo.png'

export async function sendOtpEmail(to: string, code: string) {
    const { error } = await resend.emails.send({
        from: `GIKomplain <${FROM}>`,
        to,
        subject: 'Your GIKomplain verification code',
        html: `
            <div style="background-color:#0a0a0a; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <div style="max-width: 480px; margin: 0 auto; text-align: center;">
                    <img src="${LOGO_URL}" alt="GIKI logo" width="56" height="56" style="border-radius: 10px; margin-bottom: 16px;" />
                    <div style="color: #ededed; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 32px;">GIKomplain</div>
                    <div style="color: #ededed; font-size: 16px; font-weight: 600; margin-bottom: 8px;">Verify your email</div>
                    <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Use the code below to verify your GIKomplain account. It expires in 10 minutes.</p>
                    <div style="background-color: #ffffff; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
                        <div style="color: #0a0a0a; font-size: 32px; font-weight: 700; letter-spacing: 8px;">${code}</div>
                    </div>
                    <p style="color: #737373; font-size: 12px; margin: 0;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            </div>
        `,
    })

    if (error) {
        throw new Error(`Resend failed to send OTP email: ${error.message}`)
    }
}
