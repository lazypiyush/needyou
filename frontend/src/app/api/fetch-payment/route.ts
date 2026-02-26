import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const { paymentId } = await req.json()

        if (!paymentId) {
            return NextResponse.json({ error: 'Payment ID required' }, { status: 400 })
        }

        const keyId = process.env.RAZORPAY_KEY_ID
        const keySecret = process.env.RAZORPAY_KEY_SECRET

        if (!keyId || !keySecret) {
            return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
        }

        const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

        const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Basic ${credentials}` },
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json({ error: data?.error?.description || 'Failed to fetch payment' }, { status: 500 })
        }

        return NextResponse.json({
            vpa: data.vpa || null,
            customerName: data.description || null,
            email: data.email || null,
            contact: data.contact || null,
            status: data.status,
            method: data.method,
        })
    } catch (err) {
        console.error('Fetch payment error:', err)
        return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 })
    }
}
