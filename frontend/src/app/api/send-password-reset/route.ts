import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const { email, resetLink, userName } = await request.json()

    if (!email || !resetLink) {
      return NextResponse.json(
        { error: 'Email and reset link are required' },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: 'NeedYou <noreply@need-you.xyz>', // Your verified domain
      to: [email],
      subject: 'Reset your password - NeedYou',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <!-- Header -->
              <div style="text-align: center; margin-bottom: 40px;">
                <h1 style="color: #2563eb; font-size: 32px; margin: 0;">NeedYou</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 8px;">Connect, Help, Grow</p>
              </div>

              <!-- Main Card -->
              <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <h2 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Password Reset Request 🔐</h2>
                
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                  Hi ${userName || 'there'},
                </p>

                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                  We received a request to reset the password for your NeedYou account.
                </p>

                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                  Click the button below to choose a new password:
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetLink}" 
                     style="display: inline-block; background: linear-gradient(to right, #2563eb, #4f46e5); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Reset Password
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin: 8px 0 0 0;">
                  ${resetLink}
                </p>

                <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                    <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 8px 0 0 0;">
                    <strong>🔒 Security Note:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
                  </p>
                </div>
              </div>

              <!-- Footer -->
              <div style="text-align: center; margin-top: 32px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} NeedYou. All rights reserved.
                </p>
                <p style="color: #9ca3af; font-size: 12px; margin: 8px 0 0 0;">
                  Need help? Contact us at support@needyou.com
                </p>
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error('❌ Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ Password reset email sent:', data)
    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error: any) {
    console.error('❌ Error sending password reset email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
