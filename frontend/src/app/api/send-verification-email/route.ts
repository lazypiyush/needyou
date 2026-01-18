import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

// Validate API key exists
if (!process.env.RESEND_API_KEY) {
  console.error('❌ RESEND_API_KEY is not set in environment variables')
}

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY is missing')
      return NextResponse.json(
        { error: 'Email service not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const { email, verificationLink, userName } = await request.json()

    if (!email || !verificationLink) {
      return NextResponse.json(
        { error: 'Email and verification link are required' },
        { status: 400 }
      )
    }

    const { data, error } = await resend.emails.send({
      from: 'NeedYou <noreply@need-you.xyz>', // Your verified domain
      to: [email],
      subject: 'Verify your email address - NeedYou',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
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
                <h2 style="color: #111827; font-size: 24px; margin: 0 0 16px 0;">Hi ${userName || 'there'}! 👋</h2>
                
                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                  Thanks for signing up for NeedYou! We're excited to have you on board.
                </p>

                <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                  To complete your registration, please verify your email address by clicking the button below:
                </p>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${verificationLink}" 
                     style="display: inline-block; background: linear-gradient(to right, #2563eb, #4f46e5); color: white; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                    Verify Email Address
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 32px 0 0 0;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 14px; word-break: break-all; margin: 8px 0 0 0;">
                  ${verificationLink}
                </p>

                <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                    <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 8px 0 0 0;">
                    If you didn't create an account with NeedYou, you can safely ignore this email.
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

    console.log('✅ Verification email sent:', data)
    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error: any) {
    console.error('❌ Error sending verification email:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}
