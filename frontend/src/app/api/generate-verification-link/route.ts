import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'

export async function POST(request: NextRequest) {
    try {
        const { email, userName } = await request.json()

        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            )
        }

        // Generate email verification link using Firebase Admin
        const actionCodeSettings = {
            url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/signup`,
            handleCodeInApp: false
        }

        const verificationLink = await adminAuth.generateEmailVerificationLink(
            email,
            actionCodeSettings
        )

        console.log('✅ Generated verification link for:', email)

        return NextResponse.json({
            success: true,
            verificationLink,
            email,
            userName
        })
    } catch (error: any) {
        console.error('❌ Error generating verification link:', error)
        return NextResponse.json(
            { error: error.message || 'Failed to generate verification link' },
            { status: 500 }
        )
    }
}
