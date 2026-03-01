import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface WorkerLocation {
    lat: number
    lng: number
    updatedAt: number
}

/** Worker calls this to push their current GPS position to Firestore */
export async function updateWorkerLocation(
    applicationId: string,
    lat: number,
    lng: number
): Promise<void> {
    if (!db) throw new Error('DB not initialised')
    await updateDoc(doc(db, 'job_applications', applicationId), {
        workerLat: lat,
        workerLng: lng,
        locationUpdatedAt: Date.now(),
        trackingActive: true,
    })
}

/** Stop tracking (call when job ends or component unmounts) */
export async function stopTracking(applicationId: string): Promise<void> {
    if (!db) return
    await updateDoc(doc(db, 'job_applications', applicationId), {
        trackingActive: false,
    })
}

/**
 * Real-time subscription to the worker's location.
 * Returns an unsubscribe function.
 */
export function subscribeToWorkerLocation(
    applicationId: string,
    callback: (loc: WorkerLocation) => void
): () => void {
    if (!db) return () => { }
    return onSnapshot(doc(db, 'job_applications', applicationId), (snap) => {
        if (!snap.exists()) return
        const d = snap.data()
        if (d.workerLat != null && d.workerLng != null) {
            callback({ lat: d.workerLat, lng: d.workerLng, updatedAt: d.locationUpdatedAt ?? 0 })
        }
    })
}
