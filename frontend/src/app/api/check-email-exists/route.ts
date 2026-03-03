import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { email } = await request.json()

        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        const { getAdminAuth } = await import('@/lib/firebaseAdmin')
        const adminAuth = getAdminAuth()

        try {
            await adminAuth.getUserByEmail(email)
            // If no error thrown — email exists in Firebase Auth
            return NextResponse.json({ exists: true })
        } catch (err: any) {
            if (err.code === 'auth/user-not-found') {
                return NextResponse.json({ exists: false })
            }
            throw err
        }
    } catch (error: any) {
        console.error('check-email-exists error:', error)
        // Fail open — don't block sign-in attempt on server error
        return NextResponse.json({ exists: true, error: error.message }, { status: 500 })
    }
}
