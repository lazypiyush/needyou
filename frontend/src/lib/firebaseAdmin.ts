import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        let credential;

        // Check if running in production with environment variables
        if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
            console.log('🔧 Using Firebase Admin credentials from environment variables')
            credential = admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        } else {
            // Local development - use service account file
            console.log('🔧 Using Firebase Admin credentials from serviceAccountKey.json')
            const serviceAccount = require('../../serviceAccountKey.json')
            credential = admin.credential.cert(serviceAccount)
        }

        admin.initializeApp({
            credential,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        })

        console.log('✅ Firebase Admin initialized')
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error)
        throw new Error('Firebase Admin initialization failed. Check credentials.')
    }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()

export default admin
