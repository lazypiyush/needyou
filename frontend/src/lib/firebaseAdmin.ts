import * as admin from 'firebase-admin'

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
    try {
        // Try to load service account from file
        const serviceAccount = require('../../serviceAccountKey.json')

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        })

        console.log('✅ Firebase Admin initialized')
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error)
        throw new Error('Firebase Admin initialization failed. Make sure serviceAccountKey.json exists.')
    }
}

export const adminAuth = admin.auth()
export const adminDb = admin.firestore()

export default admin
