import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import { createNotification } from './notifications'

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/** Generate a random 6-character alphanumeric code */
function generateCode(): string {
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    }
    return code
}

/** Applicant calls this to request the poster to start the job */
export async function requestStartJob(
    applicationId: string,
    jobId: string,
    jobTitle: string,
    posterId: string,
    applicantName: string
): Promise<void> {
    if (!db) throw new Error('DB not initialised')
    await updateDoc(doc(db, 'job_applications', applicationId), {
        startJobStatus: 'requested',
        startJobRequestedAt: Date.now(),
    })
    // Notify the poster
    await createNotification({
        userId: posterId,
        type: 'new_application', // reuse existing type so poster sees it
        title: '🔔 Start Job Requested',
        message: `${applicantName} wants to start the job "${jobTitle}". Open the job to accept.`,
        jobId,
        jobTitle,
        createdAt: Date.now(),
        read: false,
    })
}

/**
 * Poster accepts the start request.
 * Generates OTP, saves to Firestore, returns the code so the poster can see it.
 */
export async function acceptStartRequest(
    applicationId: string,
    jobId: string,
    jobTitle: string,
    applicantId: string,
    posterName: string
): Promise<string> {
    if (!db) throw new Error('DB not initialised')
    const code = generateCode()
    const expiry = Date.now() + CODE_TTL_MS
    await updateDoc(doc(db, 'job_applications', applicationId), {
        startJobStatus: 'code_pending',
        startJobCode: code,
        startJobCodeExpiry: expiry,
    })
    // Notify the applicant to enter the code
    await createNotification({
        userId: applicantId,
        type: 'job_hired', // reuse hired type so it navigates to Applied tab
        title: '🔑 Enter Your Start Code',
        message: `${posterName} accepted your start request for "${jobTitle}". Enter the 6-digit code they give you (expires in 5 min).`,
        jobId,
        jobTitle,
        createdAt: Date.now(),
        read: false,
    })
    return code
}

/**
 * Applicant submits the OTP.
 * Returns 'ok', 'wrong_code', or 'expired'.
 */
export async function verifyStartCode(
    applicationId: string,
    submittedCode: string
): Promise<'ok' | 'wrong_code' | 'expired'> {
    if (!db) throw new Error('DB not initialised')
    const snap = await getDoc(doc(db, 'job_applications', applicationId))
    if (!snap.exists()) throw new Error('Application not found')
    const data = snap.data()

    if (Date.now() > (data.startJobCodeExpiry ?? 0)) {
        // Expired — reset so applicant can request again
        await resetStartJob(applicationId)
        return 'expired'
    }
    if ((data.startJobCode ?? '').toUpperCase() !== submittedCode.toUpperCase()) {
        return 'wrong_code'
    }
    // Correct — start the job
    await updateDoc(doc(db, 'job_applications', applicationId), {
        startJobStatus: 'active',
        startJobCode: null,
        startJobCodeExpiry: null,
        jobStartedAt: Date.now(),
    })
    return 'ok'
}

/** Reset start job state (e.g. after code expires) so applicant can retry */
export async function resetStartJob(applicationId: string): Promise<void> {
    if (!db) throw new Error('DB not initialised')
    await updateDoc(doc(db, 'job_applications', applicationId), {
        startJobStatus: null,
        startJobCode: null,
        startJobCodeExpiry: null,
        startJobRequestedAt: null,
    })
}
