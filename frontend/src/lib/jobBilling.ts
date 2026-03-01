// Job billing lifecycle helpers — arrival → meeting OTP → bill → payment → wallet credit
import { db } from '@/lib/firebase'
import { doc, updateDoc, increment, getDoc } from 'firebase/firestore'
import { createNotification } from '@/lib/notifications'

export interface BillItem {
    reason: string
    amount: number
}

export interface Bill {
    items: BillItem[]
    total: number
    createdAt: number
}

// ── helper ──────────────────────────────────────────────────────────────────
function genCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // metres
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Phase 1: Arrival ─────────────────────────────────────────────────────────
/** Called once automatically when worker enters 200 m radius */
export async function notifyArrival(
    appId: string,
    clientId: string,
    jobTitle: string,
    workerName: string,
    jobId: string,
): Promise<void> {
    await updateDoc(doc(db!, 'job_applications', appId), {
        startJobStatus: 'arrived',
        arrivalDetected: true,
        arrivalNotifiedAt: Date.now(),
    })
    await createNotification({
        userId: clientId,
        type: 'job_update' as any,
        title: '📍 Worker Has Arrived!',
        message: `${workerName} has arrived at your location for "${jobTitle}". Open the app to generate a meeting code.`,
        jobId,
        jobTitle,
        applicationId: appId,
        createdAt: Date.now(),
        read: false,
    })
}

// ── Phase 2a: Worker requests meeting ────────────────────────────────────────
export async function requestMeeting(appId: string): Promise<void> {
    await updateDoc(doc(db!, 'job_applications', appId), {
        startJobStatus: 'meeting_requested',
    })
}

// ── Phase 2b: Client accepts → generates meeting code ────────────────────────
export async function acceptMeetingRequest(
    appId: string,
    jobId: string,
    jobTitle: string,
    workerId: string,
    posterName: string,
): Promise<void> {
    const code = genCode()
    const expiry = Date.now() + 5 * 60 * 1000 // 5 min
    await updateDoc(doc(db!, 'job_applications', appId), {
        startJobStatus: 'meeting_code_pending',
        meetingCode: code,
        meetingCodeExpiry: expiry,
    })
    await createNotification({
        userId: workerId,
        type: 'job_update' as any,
        title: '🔑 Meeting Code Ready',
        message: `${posterName} generated a code. Open the app and enter it to confirm the meeting.`,
        jobId,
        jobTitle,
        applicationId: appId,
        createdAt: Date.now(),
        read: false,
    })
}

// ── Phase 2c: Worker verifies meeting code ───────────────────────────────────
export async function verifyMeetingCode(appId: string, entered: string): Promise<'ok' | 'wrong' | 'expired'> {
    const snap = await getDoc(doc(db!, 'job_applications', appId))
    if (!snap.exists()) return 'wrong'
    const data = snap.data()
    if (!data.meetingCode || !data.meetingCodeExpiry) return 'wrong'
    if (Date.now() > data.meetingCodeExpiry) {
        // Auto-reset
        await updateDoc(doc(db!, 'job_applications', appId), {
            startJobStatus: 'meeting_requested',
            meetingCode: null,
            meetingCodeExpiry: null,
        })
        return 'expired'
    }
    if (entered.trim().toUpperCase() !== data.meetingCode) return 'wrong'
    await updateDoc(doc(db!, 'job_applications', appId), {
        startJobStatus: 'working',
        meetingConfirmedAt: Date.now(),
        meetingCode: null,
        meetingCodeExpiry: null,
    })
    return 'ok'
}

// ── Phase 3: Worker submits bill ──────────────────────────────────────────────
export async function submitBill(
    appId: string,
    jobId: string,
    items: BillItem[],
    total: number,
    clientId: string,
    workerName: string,
    jobTitle: string,
): Promise<void> {
    const bill: Bill = { items, total, createdAt: Date.now() }
    await updateDoc(doc(db!, 'job_applications', appId), {
        bill,
        billStatus: 'pending_review',
        startJobStatus: 'bill_submitted',
        billRejectedAt: null,
    })
    // Also update job budget to reflect the new bill amount
    await updateDoc(doc(db!, 'jobs', jobId), { budget: total })
    await createNotification({
        userId: clientId,
        type: 'job_update' as any,
        title: '🧾 Bill Submitted',
        message: `${workerName} submitted a bill of ₹${total.toLocaleString('en-IN')} for "${jobTitle}". Open the app to review.`,
        jobId,
        jobTitle,
        applicationId: appId,
        createdAt: Date.now(),
        read: false,
    })
}

// ── Phase 4a: Client rejects bill ────────────────────────────────────────────
export async function rejectBill(
    appId: string,
    workerId: string,
    jobId: string,
    jobTitle: string,
    clientName: string,
): Promise<void> {
    await updateDoc(doc(db!, 'job_applications', appId), {
        billStatus: 'rejected',
        billRejectedAt: Date.now(),
        startJobStatus: 'working', // allow worker to create new bill
    })
    await createNotification({
        userId: workerId,
        type: 'job_update' as any,
        title: '❌ Bill Rejected',
        message: `${clientName} rejected your bill for "${jobTitle}". Please create a new bill.`,
        jobId,
        jobTitle,
        applicationId: appId,
        createdAt: Date.now(),
        read: false,
    })
}

// ── Phase 4b: Client accepts → mark processing ───────────────────────────────
export async function acceptBillForPayment(appId: string, razorpayOrderId: string): Promise<void> {
    await updateDoc(doc(db!, 'job_applications', appId), {
        billStatus: 'accepted',
        startJobStatus: 'bill_accepted',
        razorpayOrderId,
        paymentStatus: 'processing',
    })
}

// ── Phase 5: Payment complete — wallet credit ────────────────────────────────
export async function completePayment(
    appId: string,
    jobId: string,
    workerId: string,
    total: number,
    paymentId: string,
    clientName: string,
    jobTitle: string,
): Promise<void> {
    // Mark application as completed
    await updateDoc(doc(db!, 'job_applications', appId), {
        startJobStatus: 'completed',
        paymentStatus: 'completed',
        razorpayPaymentId: paymentId,
        paidAt: Date.now(),
    })
    // Mark job as completed
    await updateDoc(doc(db!, 'jobs', jobId), { status: 'completed', completedAt: Date.now() })
    // Credit worker wallet
    await updateDoc(doc(db!, 'users', workerId), {
        walletBalance: increment(total),
    })
    // Notify worker
    await createNotification({
        userId: workerId,
        type: 'job_update' as any,
        title: '💰 Payment Received!',
        message: `${clientName} paid ₹${total.toLocaleString('en-IN')} for "${jobTitle}". Check your wallet!`,
        jobId,
        jobTitle,
        applicationId: appId,
        createdAt: Date.now(),
        read: false,
    })
}

// ── Phase 5 (fail): Payment failed ───────────────────────────────────────────
export async function failPayment(appId: string): Promise<void> {
    await updateDoc(doc(db!, 'job_applications', appId), {
        paymentStatus: 'failed',
        startJobStatus: 'bill_accepted', // keep in accepted state; client can retry
    })
}
