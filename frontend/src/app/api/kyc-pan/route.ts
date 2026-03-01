import { NextRequest, NextResponse } from 'next/server'

const SUREPASS_BASE_URL = process.env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.app'
const SUREPASS_API_TOKEN = process.env.SUREPASS_API_TOKEN

/**
 * POST /api/kyc-pan
 * Verifies a PAN number via Surepass and validates name match
 */
export async function POST(req: NextRequest) {
    try {
        if (!SUREPASS_API_TOKEN) {
            return NextResponse.json(
                { error: 'Surepass API not configured. Please contact support.' },
                { status: 500 }
            )
        }

        const { panNumber, name } = await req.json()

        if (!panNumber || !name) {
            return NextResponse.json(
                { error: 'PAN number and name are required.' },
                { status: 400 }
            )
        }

        // Validate PAN format: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
        const normalizedPan = panNumber.trim().toUpperCase()

        if (!panRegex.test(normalizedPan)) {
            return NextResponse.json(
                { error: 'Invalid PAN format. It should be like ABCDE1234F (5 letters, 4 digits, 1 letter).' },
                { status: 400 }
            )
        }

        console.log('🔍 Verifying PAN for name match:', normalizedPan.slice(0, 5) + '****')

        const response = await fetch(`${SUREPASS_BASE_URL}/api/v1/pan/pan`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUREPASS_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id_number: normalizedPan
            })
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('❌ Surepass PAN API error:', response.status, errorData)

            if (response.status === 401) {
                return NextResponse.json(
                    { error: 'KYC service authentication failed. Please contact support.' },
                    { status: 502 }
                )
            }
            if (response.status === 422 || response.status === 400) {
                return NextResponse.json(
                    { error: 'Invalid PAN number. Please check and try again.' },
                    { status: 400 }
                )
            }
            if (response.status === 429) {
                return NextResponse.json(
                    { error: 'Too many requests. Please wait a moment and try again.' },
                    { status: 429 }
                )
            }
            return NextResponse.json(
                { error: errorData.message || 'PAN verification failed. Please try again.' },
                { status: 502 }
            )
        }

        const data = await response.json()
        const panData = data?.data

        if (!panData) {
            return NextResponse.json(
                { error: 'Invalid response from PAN service. Please try again.' },
                { status: 502 }
            )
        }

        // Check if PAN exists and is valid
        if (!panData.pan_number && !panData.full_name) {
            return NextResponse.json(
                { error: 'PAN not found in database. Please check and try again.' },
                { status: 404 }
            )
        }

        // Perform name match (case-insensitive, partial match allowed for name variations)
        const registeredName: string = (panData.full_name || panData.name || '').trim().toUpperCase()
        const providedName: string = name.trim().toUpperCase()

        // Normalize names — remove extra spaces
        const normRegistered = registeredName.replace(/\s+/g, ' ')
        const normProvided = providedName.replace(/\s+/g, ' ')

        // Check for full match first
        const fullMatch = normRegistered === normProvided

        // Check for partial match (all words of provided name appear in registered name)
        const providedWords = normProvided.split(' ').filter(Boolean)
        const partialMatch = providedWords.every(word => normRegistered.includes(word))

        const nameMatches = fullMatch || partialMatch

        console.log(`📋 PAN name match: ${nameMatches ? '✅' : '❌'} (registered: "${registeredName}", provided: "${name}")`)

        if (!nameMatches) {
            return NextResponse.json(
                {
                    error: `Name doesn't match PAN records. The name on PAN is "${registeredName}", but you provided "${name}". Please use the exact name as registered on your PAN card.`,
                    nameMismatch: true,
                    registeredName: registeredName // Return for UX — show what name is on PAN
                },
                { status: 422 }
            )
        }

        // Success
        return NextResponse.json({
            success: true,
            panNumber: normalizedPan,
            panName: registeredName,
            panType: panData.pan_type || null,
            category: panData.category || null
        })

    } catch (error: any) {
        console.error('❌ PAN route error:', error)

        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
            return NextResponse.json(
                { error: 'KYC service timed out. Please try again.' },
                { status: 504 }
            )
        }

        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again later.' },
            { status: 500 }
        )
    }
}
