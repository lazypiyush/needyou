import { NextRequest, NextResponse } from 'next/server'

const SUREPASS_BASE_URL = process.env.SUREPASS_BASE_URL || 'https://kyc-api.surepass.app'
const SUREPASS_API_TOKEN = process.env.SUREPASS_API_TOKEN

/**
 * POST /api/kyc-aadhaar
 * Creates a DigiLocker session via Surepass DigiBoost SDK
 * Endpoint: POST /api/v1/digilocker/initialize
 * Returns: { token, clientId } — token goes directly into window.DigiboostSdk()
 */
export async function POST(req: NextRequest) {
    try {
        if (!SUREPASS_API_TOKEN) {
            return NextResponse.json({ error: 'KYC service not configured.' }, { status: 500 })
        }

        const { userId } = await req.json().catch(() => ({}))
        if (!userId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 })

        console.log('🔍 Creating DigiLocker session for user:', userId)

        // Abort if Surepass doesn't respond within 10 seconds
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 10000)

        let response: Response
        try {
            response = await fetch(`${SUREPASS_BASE_URL}/api/v1/digilocker/initialize`, {
                method: 'POST',
                signal: ctrl.signal,
                headers: {
                    'Authorization': `Bearer ${SUREPASS_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        signup_flow: true,
                        skip_main_screen: false
                    }
                })
            })
        } catch (e: any) {
            clearTimeout(timer)
            if (e?.name === 'AbortError')
                return NextResponse.json({ error: 'DigiLocker service timed out. Please try again.' }, { status: 504 })
            throw e
        }
        clearTimeout(timer)

        const text = await response.text()
        console.log('DigiLocker init response:', response.status, text.slice(0, 300))

        if (!response.ok) {
            let err: any = {}
            try { err = JSON.parse(text) } catch { }
            if (response.status === 401) return NextResponse.json({ error: 'KYC auth failed. Contact support.' }, { status: 502 })
            if (response.status === 429) return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
            return NextResponse.json({ error: err?.message || err?.errors?.data || 'Failed to start DigiLocker.' }, { status: 502 })
        }

        let data: any = {}
        try { data = JSON.parse(text) } catch {
            return NextResponse.json({ error: 'Invalid response from KYC service.' }, { status: 502 })
        }

        const token = data?.data?.token
        const clientId = data?.data?.client_id

        if (!token) {
            console.error('No session token in DigiLocker response:', data)
            return NextResponse.json({ error: 'No session token returned. Try again.' }, { status: 502 })
        }

        return NextResponse.json({ success: true, token, clientId })

    } catch (err: any) {
        console.error('❌ Aadhaar POST error:', err)
        return NextResponse.json({ error: 'Unexpected error. Please try again.' }, { status: 500 })
    }
}

/**
 * GET /api/kyc-aadhaar?clientId=xxx
 * Downloads Aadhaar data after DigiLocker authorization
 * Endpoint: GET /api/v1/digilocker/download-aadhaar/{client_id}
 */
export async function GET(req: NextRequest) {
    try {
        if (!SUREPASS_API_TOKEN) {
            return NextResponse.json({ error: 'KYC service not configured.' }, { status: 500 })
        }

        const { searchParams } = new URL(req.url)
        const clientId = searchParams.get('clientId')
        if (!clientId) return NextResponse.json({ error: 'Client ID is required.' }, { status: 400 })

        console.log('🔍 Downloading Aadhaar for clientId:', clientId)

        // Client ID is in the URL path
        const response = await fetch(
            `${SUREPASS_BASE_URL}/api/v1/digilocker/download-aadhaar/${encodeURIComponent(clientId)}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${SUREPASS_API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        )

        const text = await response.text()
        console.log('Download Aadhaar response:', response.status, text.slice(0, 300))

        if (!response.ok) {
            let err: any = {}
            try { err = JSON.parse(text) } catch { }
            const msg = err?.message || ''
            if (response.status === 404) {
                return NextResponse.json({ error: 'Session expired or not found. Please restart.', pending: false }, { status: 404 })
            }
            if (msg.toLowerCase().includes('pending') || msg.toLowerCase().includes('not complete')) {
                return NextResponse.json({ error: 'Still processing...', pending: true }, { status: 202 })
            }
            return NextResponse.json({ error: msg || 'Failed to fetch Aadhaar data.' }, { status: 502 })
        }

        let data: any = {}
        try { data = JSON.parse(text) } catch { }

        // Log all top-level keys from Surepass to identify any undocumented fields (e.g. pdf_url)
        console.log('📦 Surepass download-aadhaar keys:', Object.keys(data?.data || {}))

        const xml = data?.data?.aadhaar_xml_data
        const meta = data?.data?.digilocker_metadata

        // Surepass returns 422 OR null-valued objects when user exited without authorizing Aadhaar
        const hasAadhaarData = xml?.full_name || xml?.masked_aadhaar || meta?.name

        if (!xml && !meta) {
            return NextResponse.json({ error: 'Aadhaar document not found.', missingAadhaar: true }, { status: 422 })
        }

        if (!hasAadhaarData) {
            return NextResponse.json({ error: 'Aadhaar not authorized in DigiLocker.', missingAadhaar: true }, { status: 422 })
        }

        // ── Fetch Aadhaar XML (official signed doc) ───────────────────────────
        let aadhaarXmlContent: string | null = null
        const xmlUrl: string | null = data?.data?.xml_url || null
        if (xmlUrl) {
            try {
                const xmlRes = await fetch(xmlUrl)
                if (xmlRes.ok) {
                    aadhaarXmlContent = await xmlRes.text()
                    console.log('✅ Aadhaar XML fetched, size:', aadhaarXmlContent.length, 'bytes')
                }
            } catch (e) {
                console.warn('⚠️ Could not fetch Aadhaar XML:', e)
            }
        }

        // ── Fetch Surepass pre-built PDF (if Surepass provides it) ───────────
        // Common field names Surepass might use — we check all of them
        let aadhaarPdfBase64: string | null = null
        const pdfUrl: string | null =
            data?.data?.pdf_url ||
            data?.data?.aadhaar_pdf_url ||
            data?.data?.pdf_link ||
            data?.data?.zip_url ||      // sometimes a ZIP containing the PDF
            null
        if (pdfUrl) {
            try {
                console.log('📄 Found Surepass PDF URL:', pdfUrl.substring(0, 60) + '...')
                const pdfRes = await fetch(pdfUrl)
                if (pdfRes.ok) {
                    const buf = await pdfRes.arrayBuffer()
                    aadhaarPdfBase64 = Buffer.from(buf).toString('base64')
                    console.log('✅ Aadhaar PDF fetched, size:', buf.byteLength, 'bytes')
                }
            } catch (e) {
                console.warn('⚠️ Could not fetch Aadhaar PDF:', e)
            }
        } else {
            console.log('ℹ️ No PDF URL found in Surepass response (keys checked: pdf_url, aadhaar_pdf_url, pdf_link, zip_url)')
        }

        return NextResponse.json({
            success: true,
            name: xml?.full_name || meta?.name || null,
            dob: xml?.dob || meta?.dob || null,
            gender: xml?.gender || meta?.gender || null,
            maskedAadhaar: xml?.masked_aadhaar || null,
            profileImage: xml?.profile_image || null,  // base64 JPEG
            address: xml?.address ? {
                house: xml.address.house || null,
                street: xml.address.street || null,
                loc: xml.address.loc || null,
                vtc: xml.address.vtc || null,
                district: xml.address.district || null,
                state: xml.address.state || null,
                pincode: xml.address.pincode || null,
                country: xml.address.country || 'India',
            } : null,
            aadhaarXmlContent,
            aadhaarPdfBase64,   // Surepass pre-built PDF (base64), null if not provided by Surepass
        })

    } catch (err: any) {
        console.error('❌ Aadhaar GET error:', err)
        return NextResponse.json({ error: 'Failed to fetch Aadhaar data.' }, { status: 500 })
    }
}
