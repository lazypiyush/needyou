import { NextRequest, NextResponse } from 'next/server'

const SUREPASS_API_TOKEN = process.env.SUREPASS_API_TOKEN!
// Note: face liveness uses .io domain, DigiLocker uses .app
const LIVENESS_URL = 'https://kyc-api.surepass.io/api/v1/face/face-liveness'
const MIN_CONFIDENCE = 40   // minimum confidence score to accept as live

export async function POST(req: NextRequest) {
    try {
        const { imageData } = await req.json()
        if (!imageData) return NextResponse.json({ error: 'No image provided.' }, { status: 400 })

        // Strip data URL prefix (data:image/jpeg;base64,...) to get raw base64
        const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
        const imageBuffer = Buffer.from(base64, 'base64')

        // Build multipart/form-data — Surepass expects a file upload
        const formData = new FormData()
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
        formData.append('file', blob, 'liveness.jpg')

        console.log('🎭 Calling Surepass Face Liveness API...')

        const res = await fetch(LIVENESS_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_TOKEN}`,
                // Do NOT set Content-Type — fetch sets it with boundary automatically for FormData
            },
            body: formData,
        })

        const data = await res.json()
        console.log('🎭 Surepass Liveness response:', JSON.stringify(data))

        if (!res.ok || !data.success) {
            return NextResponse.json({
                error: data.message || 'Liveness check failed.',
                live: false
            }, { status: 502 })
        }

        const live: boolean = data?.data?.live ?? false
        const confidence: number = data?.data?.confidence ?? 0

        console.log(`🎭 Liveness result: live=${live}, confidence=${confidence}`)

        if (!live || confidence < MIN_CONFIDENCE) {
            return NextResponse.json({
                live: false,
                confidence,
                error: `Not a real face detected (score: ${confidence}/100). Please ensure good lighting and use your actual face.`
            })
        }

        return NextResponse.json({ live: true, confidence })

    } catch (err: any) {
        console.error('❌ Liveness API error:', err)
        return NextResponse.json({ error: 'Liveness check failed. Please try again.' }, { status: 500 })
    }
}
