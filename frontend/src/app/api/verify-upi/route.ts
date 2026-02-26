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
            return NextResponse.json({ success: false, error: 'Razorpay keys not configured on server' }, { status: 500 })
        }

        // Use Buffer for reliable base64 encoding in Node.js runtime
        const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

        const response = await fetch('https://api.razorpay.com/v1/payments/validate/vpa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({ vpa }),
        })

        const data = await response.json()
        console.log('Razorpay VPA response:', response.status, JSON.stringify(data))

        if (!response.ok) {
            const errMsg = data?.error?.description || data?.error?.code || JSON.stringify(data)
            return NextResponse.json(
                { success: false, error: errMsg },
                { status: 200 }
            )
        }

        // Razorpay returns success as boolean true when VPA is valid
        const isVerified = data.success === true || data.success === 'true'

        return NextResponse.json({
            success: isVerified,
            customerName: data.customer_name || null,
            vpa: data.vpa,
            // Include raw for debugging (remove later)
            _raw: process.env.NODE_ENV === 'development' ? data : undefined,
        })
    } catch (err) {
        console.error('UPI verify error:', err)
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
    }
}
