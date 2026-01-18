import * as admin from 'firebase-admin'

let adminAuthInstance: admin.auth.Auth | null = null
let adminDbInstance: admin.firestore.Firestore | null = null

// Initialize Firebase Admin SDK (only runs at runtime, not during build)
function initializeFirebaseAdmin() {
    if (adminAuthInstance && adminDbInstance) {
        return { adminAuth: adminAuthInstance, adminDb: adminDbInstance }
    }

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

    adminAuthInstance = admin.auth()
    adminDbInstance = admin.firestore()

    return { adminAuth: adminAuthInstance, adminDb: adminDbInstance }
}

// Export function instead of instances
export function getAdminAuth() {
    const { adminAuth } = initializeFirebaseAdmin()
    return adminAuth
}

export function getAdminDb() {
    const { adminDb } = initializeFirebaseAdmin()
    return adminDb
}

export default admin
