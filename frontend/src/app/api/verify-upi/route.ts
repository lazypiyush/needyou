import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const { vpa } = await req.json()

        if (!vpa || typeof vpa !== 'string') {
            return NextResponse.json({ success: false, error: 'VPA is required' }, { status: 400 })
        }

        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            return NextResponse.json({ success: false, error: 'Razorpay not configured' }, { status: 500 })
        }

        const credentials = btoa(`${keyId}:${keySecret}`)

        const response = await fetch('https://api.razorpay.com/v1/payments/validate/vpa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({ vpa }),
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: data?.error?.description || 'Invalid UPI ID' },
                { status: 200 }
            )
        }

        return NextResponse.json({
            success: data.success === true,
            customerName: data.customer_name || null,
            vpa: data.vpa,
        })
    } catch (err) {
        console.error('UPI verify error:', err)
        return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
    }
}
