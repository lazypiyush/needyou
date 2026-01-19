import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        // Dynamic import and lazy initialization
        const { getAdminAuth } = await import('@/lib/firebaseAdmin')
        const adminAuth = getAdminAuth()

        // Generate password reset link using Firebase Admin
        const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/signin`,
            handleCodeInApp: false
        }

        const resetLink = await adminAuth.generatePasswordResetLink(
            email,
            actionCodeSettings
        )

        console.log('✅ Generated password reset link for:', email)

        return NextResponse.json({
            success: true,
            resetLink,
            email
        })
    } catch (error: any) {
        console.error('❌ Error generating password reset link:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate password reset link' },
            { status: 500 }
        )
    }
}
