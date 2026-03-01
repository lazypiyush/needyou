import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = await req.json()

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET
        if (!keySecret) {
            return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
        }

        // Razorpay signature verification — SHA256 HMAC
        const body = `${razorpayOrderId}|${razorpayPaymentId}`
        const expectedSig = crypto
            .createHmac('sha256', keySecret)
            .update(body)
            .digest('hex')

        if (expectedSig !== razorpaySignature) {
            return NextResponse.json({ error: 'Payment signature invalid', valid: false }, { status: 400 })
        }

        return NextResponse.json({ valid: true })
    } catch (err) {
        console.error('Verify payment error:', err)
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
    }
}
