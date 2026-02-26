import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
        }

        const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

        // Create a ₹1 order (amount in paise = 100)
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({
                amount: 100, // ₹1 in paise
                currency: 'INR',
                receipt: `upi_verify_${Date.now()}`,
                notes: { purpose: 'UPI ID verification' },
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json({ error: data?.error?.description || 'Failed to create order' }, { status: 500 })
        }

        return NextResponse.json({ orderId: data.id, amount: data.amount, currency: data.currency })
    } catch (err) {
        console.error('Create order error:', err)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
