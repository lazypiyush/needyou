import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import admin from '@/lib/firebaseAdmin'

export async function POST(request: NextRequest) {
    try {
        const { userId, title, body, data } = await request.json()

        if (!userId || !title || !body) {
            return NextResponse.json({ error: 'Missing required fields: userId, title, body' }, { status: 400 })
        }

        // Get the recipient's FCM token from Firestore
        const adminDb = getAdminDb()
        const userDoc = await adminDb.collection('users').doc(userId).get()

        if (!userDoc.exists) {
            console.warn(`⚠️ User ${userId} not found in Firestore`)
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const fcmToken = userDoc.data()?.fcmToken
        if (!fcmToken) {
            console.warn(`⚠️ No FCM token for user ${userId}`)
            return NextResponse.json({ error: 'No FCM token for this user' }, { status: 200 })
            // 200 — not an error, user just hasn't granted notifications
        }

        // Build FCM message
        const message: admin.messaging.Message = {
            token: fcmToken,
            notification: { title, body },
            data: {
                ...(data || {}),
                // Ensure all values are strings (FCM requirement)
                title,
                body,
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'needyou_notifications',
                    sound: 'default',
                    priority: 'high',
                    defaultSound: true,
                },
            },
        }

        const response = await admin.messaging().send(message)
        console.log(`✅ FCM push sent to user ${userId}: ${response}`)

        return NextResponse.json({ success: true, messageId: response })
    } catch (error: any) {
        // Token expired / not registered — clean it up
        if (
            error.code === 'messaging/registration-token-not-registered' ||
            error.code === 'messaging/invalid-registration-token'
        ) {
            console.warn('⚠️ Stale FCM token — consider clearing from Firestore')
        }
        console.error('❌ FCM send error:', error)
        return NextResponse.json({ error: error.message || 'Failed to send notification' }, { status: 500 })
    }
}
