import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const { amount, applicationId } = await req.json()

        // Validate
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }
        if (!applicationId) {
            return NextResponse.json({ error: 'applicationId required' }, { status: 400 })
        }

        const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
        }

        const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${credentials}`,
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // paise
                currency: 'INR',
                receipt: `bill_${applicationId}_${Date.now()}`,
                notes: { purpose: 'NeedYou job bill payment', applicationId },
            }),
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(
                { error: data?.error?.description || 'Failed to create order' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            orderId: data.id,
            amount: data.amount,
            currency: data.currency,
        })
    } catch (err) {
        console.error('Create bill order error:', err)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}
