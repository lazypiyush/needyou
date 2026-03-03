'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Phone, Clock, CheckCircle, XCircle, IndianRupee, MessageCircle, Loader2, Zap, Play, MapPin, Receipt, Eye, Map } from 'lucide-react'
import { getUserOwnApplication } from '@/lib/auth'
import { useTheme } from 'next-themes'
import { useAuth } from '@/context/AuthContext'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { respondToRenegotiation } from '@/lib/renegotiation'
import { requestStartJob, verifyStartCode } from '@/lib/startJob'
import { useModalHistory } from '@/hooks/useModalHistory'
import { pushChatState } from '@/lib/chatNavigation'
import { getCompressedImageUrl } from '@/lib/cloudinary'
import { updateWorkerLocation } from '@/lib/liveTracking'
import LiveTrackingMap from './LiveTrackingMap'
import { motion, AnimatePresence } from 'framer-motion'
import { calcDistance, notifyArrival, requestMeeting, verifyMeetingCode as verifyMeetingOtp, submitBill } from '@/lib/jobBilling'
import JobBillModal, { type BillItem } from './JobBillModal'
import UserProfileSheet from './UserProfileSheet'

interface ViewMyApplicationModalProps {
    jobId: string
    jobTitle: string
    jobBudget: number | null
    jobPosterName: string
    jobPosterId: string
    jobPosterEmail: string
    onClose: () => void
}

export default function ViewMyApplicationModal({
    jobId,
    jobTitle,
    jobBudget,
    jobPosterName,
    jobPosterId,
    jobPosterEmail,
    onClose
}: ViewMyApplicationModalProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [application, setApplication] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [jobPosterPhone, setJobPosterPhone] = useState<string | undefined>(undefined)
    const [jobPosterAvatar, setJobPosterAvatar] = useState<string | null>(null)
    const [livePosterName, setLivePosterName] = useState<string>('')
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)
    const [selfAvatar, setSelfAvatar] = useState<string | null>(null)
    const [selfName, setSelfName] = useState<string>('')

    // Back button closes modal
    useModalHistory(true, onClose)

    // Renegotiation state
    const [showPaidReceipt, setShowPaidReceipt] = useState(false)
    const [isNegotiating, setIsNegotiating] = useState(false)
    const [newOffer, setNewOffer] = useState<string>('')
    const [negotiationReason, setNegotiationReason] = useState<string>('')
    const [responding, setResponding] = useState(false)

    // Start Job state
    const [enteredCode, setEnteredCode] = useState('')
    const [codeSubmitting, setCodeSubmitting] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // GPS / live tracking state (worker side)
    const [gpsError, setGpsError] = useState<string | null>(null)
    const [workerLocation, setWorkerLocation] = useState<{ lat: number; lng: number; updatedAt: number } | null>(null)
    const [showTrackingMap, setShowTrackingMap] = useState(true)
    const watchIdRef = useRef<number | null>(null)
    const [jobDestination, setJobDestination] = useState<{ lat: number; lng: number } | null>(null)
    const jobDestinationRef = useRef<{ lat: number; lng: number } | null>(null)
    const arrivalNotifiedRef = useRef(false)
    // Meeting OTP state (in-person meeting confirmation after arrival)
    const [meetingEnteredCode, setMeetingEnteredCode] = useState('')
    const [meetingCodeSubmitting, setMeetingCodeSubmitting] = useState(false)
    const [meetingSecondsLeft, setMeetingSecondsLeft] = useState(0)
    const meetingCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Bill & animation state
    const [showBillModal, setShowBillModal] = useState(false)
    const [showBillView, setShowBillView] = useState(false)
    const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false)
    const welcomeShownRef = useRef(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Real-time listener on the application doc so Start Job status syncs instantly
    useEffect(() => {
        if (!user?.uid || !db) return
        setLoading(true)
        const q = query(
            collection(db, 'job_applications'),
            where('jobId', '==', jobId),
            where('userId', '==', user.uid)
        )
        const unsub = onSnapshot(q, (snap) => {
            if (snap.empty) { setApplication(null); setLoading(false); return }
            const d = snap.docs[0]
            setApplication({ id: d.id, ...d.data() })
            setLoading(false)
        }, (err) => {
            console.error('Application listener error:', err)
            setLoading(false)
        })
        return () => unsub()
    }, [jobId, user?.uid])

    // Countdown timer for OTP expiry
    useEffect(() => {
        const expiry: number = application?.startJobCodeExpiry ?? 0
        if (!expiry) { setSecondsLeft(0); return }
        const tick = () => {
            const s = Math.max(0, Math.floor((expiry - Date.now()) / 1000))
            setSecondsLeft(s)
        }
        tick()
        if (countdownRef.current) clearInterval(countdownRef.current)
        countdownRef.current = setInterval(tick, 1000)
        return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
    }, [application?.startJobCodeExpiry])

    // Fetch the job's saved location (latitude/longitude) for the direction route
    useEffect(() => {
        if (!db || !jobId) return
        import('firebase/firestore').then(({ doc, getDoc }) => {
            getDoc(doc(db!, 'jobs', jobId)).then(snap => {
                if (!snap.exists()) return
                const d = snap.data()
                if (d.location?.latitude != null && d.location?.longitude != null) {
                    setJobDestination({ lat: d.location.latitude, lng: d.location.longitude })
                }
            })
        })
    }, [jobId])

    // Keep jobDestinationRef in sync for the watchPosition closure
    useEffect(() => { jobDestinationRef.current = jobDestination }, [jobDestination])

    // ── Worker GPS watchPosition — runs for all active tracking phases ──
    const TRACKING_PHASES = ['active', 'arrived', 'meeting_requested', 'meeting_code_pending', 'working']
    useEffect(() => {
        const status = application?.startJobStatus ?? ''
        if (!TRACKING_PHASES.includes(status)) return
        if (watchIdRef.current !== null) return
        if (!navigator.geolocation) { setGpsError('Geolocation not supported.'); return }

        let lastPush = 0
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                setGpsError(null)
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() }
                setWorkerLocation(loc)
                if (Date.now() - lastPush > 5000 && application?.id) {
                    lastPush = Date.now()
                    updateWorkerLocation(application.id, loc.lat, loc.lng).catch(console.error)
                }
                // ── Auto-detect arrival within 500m ──
                // GPS error on mobile is typically 50-150 m per device, so two phones
                // at the same spot can read 100-300 m apart. 500 m is generous but
                // still meaningful (won't trigger from a different neighbourhood).
                if (status === 'active' && !application?.arrivalDetected && !arrivalNotifiedRef.current && jobDestinationRef.current) {
                    const dist = calcDistance(loc.lat, loc.lng, jobDestinationRef.current.lat, jobDestinationRef.current.lng)
                    if (dist <= 500) {
                        arrivalNotifiedRef.current = true
                        notifyArrival(application.id, jobPosterId, jobTitle, application.userName || 'The worker', jobId).catch(console.error)
                    }
                }
            },
            (err) => setGpsError(err.message),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
        )
        return () => {
            if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [application?.startJobStatus, application?.id])

    // Meeting OTP countdown
    useEffect(() => {
        const expiry: number = application?.meetingCodeExpiry ?? 0
        if (!expiry || application?.startJobStatus !== 'meeting_code_pending') { setMeetingSecondsLeft(0); return }
        const tick = () => setMeetingSecondsLeft(Math.max(0, Math.floor((expiry - Date.now()) / 1000)))
        tick()
        if (meetingCountdownRef.current) clearInterval(meetingCountdownRef.current)
        meetingCountdownRef.current = setInterval(tick, 1000)
        return () => { if (meetingCountdownRef.current) clearInterval(meetingCountdownRef.current) }
    }, [application?.meetingCodeExpiry, application?.startJobStatus])

    // Welcome animation — show once when meeting confirmed
    useEffect(() => {
        if (application?.startJobStatus === 'working' && application?.meetingConfirmedAt && !welcomeShownRef.current) {
            const age = Date.now() - (application.meetingConfirmedAt as number)
            if (age < 60000) { // within 1 minute of confirmation
                welcomeShownRef.current = true
                setShowWelcomeAnimation(true)
            }
        }
    }, [application?.startJobStatus, application?.meetingConfirmedAt])

    useEffect(() => {
        const fetchJobPosterPhone = async () => {
            if (!jobPosterId) return
            try {
                if (!db) return
                const userDoc = await getDoc(doc(db, 'users', jobPosterId))
                if (userDoc.exists()) {
                    const userData = userDoc.data()
                    setJobPosterPhone(userData?.phoneNumber)
                    setLivePosterName(userData?.['kycData.aadhaarName'] || userData?.kycData?.aadhaarName || jobPosterName || '')
                    if (userData?.photoURL) {
                        setJobPosterAvatar(getCompressedImageUrl(userData.photoURL))
                    }
                }
            } catch (error) {
                console.error('Error fetching job poster details:', error)
            }
        }
        fetchJobPosterPhone()
    }, [jobPosterId])

    // Fetch current user's own avatar + name
    useEffect(() => {
        const fetchSelf = async () => {
            if (!user?.uid || !db) return
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid))
                if (userDoc.exists()) {
                    const userData = userDoc.data()
                    setSelfName(userData?.['kycData.aadhaarName'] || userData?.kycData?.aadhaarName || '')
                    if (userData?.photoURL) {
                        setSelfAvatar(getCompressedImageUrl(userData.photoURL))
                    }
                }
            } catch (error) {
                console.error('Error fetching self profile:', error)
            }
        }
        fetchSelf()
    }, [user?.uid])

    const formatTimeAgo = (timestamp: number) => {
        const now = Date.now()
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
        return `${days} day${days !== 1 ? 's' : ''} ago`
    }

    const handleAcceptOffer = async () => {
        if (!application) return

        try {
            setResponding(true)
            await respondToRenegotiation(
                application.id,
                jobId,
                jobTitle,
                jobPosterId,
                true // accept
            )
            // Refresh application
            const app = await getUserOwnApplication(jobId, user!.uid)
            setApplication(app)
            alert('Offer accepted!')
        } catch (error) {
            console.error('Error accepting offer:', error)
            alert('Failed to accept offer')
        } finally {
            setResponding(false)
        }
    }

    const handleSendCounterOffer = async () => {
        const offerAmount = parseFloat(newOffer)
        if (isNaN(offerAmount) || offerAmount <= 0) {
            alert('Please enter a valid amount')
            return
        }

        if (!application) return

        try {
            setResponding(true)
            await respondToRenegotiation(
                application.id,
                jobId,
                jobTitle,
                jobPosterId,
                false, // don't accept
                offerAmount,
                negotiationReason || undefined
            )
            // Refresh application
            const app = await getUserOwnApplication(jobId, user!.uid)
            setApplication(app)
            setIsNegotiating(false)
            setNewOffer('')
            setNegotiationReason('')
            alert('Counter-offer sent!')
        } catch (error) {
            console.error('Error sending counter-offer:', error)
            alert('Failed to send counter-offer')
        } finally {
            setResponding(false)
        }
    }

    const handleRequestStart = async () => {
        if (!application) return
        try {
            await requestStartJob(application.id, jobId, jobTitle, jobPosterId, selfName || 'The applicant')
        } catch (err) {
            console.error(err)
            alert('Failed to send start request. Please try again.')
        }
    }

    const handleVerifyCode = async () => {
        if (!application || enteredCode.length !== 6) return
        try {
            setCodeSubmitting(true)
            const result = await verifyStartCode(application.id, enteredCode)
            if (result === 'ok') {
                setEnteredCode('')
            } else if (result === 'expired') {
                alert('Code expired! Please press “Request to Start Job” again.')
                setEnteredCode('')
            } else {
                alert('Wrong code. Double-check with the job poster and try again.')
            }
        } catch (err) {
            console.error(err)
            alert('Error verifying code.')
        } finally {
            setCodeSubmitting(false)
        }
    }

    const handleVerifyMeetingCode = async () => {
        if (!application || meetingEnteredCode.length !== 6) return
        setMeetingCodeSubmitting(true)
        try {
            const result = await verifyMeetingOtp(application.id, meetingEnteredCode)
            if (result === 'ok') {
                setMeetingEnteredCode('')
            } else if (result === 'expired') {
                setMeetingEnteredCode('')
                alert('Code expired! Ask the client to generate a new meeting code.')
            } else {
                alert('Incorrect code. Double-check with the client.')
            }
        } catch (err) {
            console.error(err)
            alert('Error verifying meeting code.')
        } finally {
            setMeetingCodeSubmitting(false)
        }
    }

    const handleSubmitBill = async (items: BillItem[], total: number) => {
        if (!application?.id || !user?.uid) return
        await submitBill(
            application.id, jobId, items, total,
            jobPosterId,
            selfName || application.userName || 'Worker',
            jobTitle
        )
        setShowBillModal(false)
    }

    if (!mounted) return null

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <div
                className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl"
                style={{
                    backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                    boxShadow: isDark
                        ? '0 25px 50px -12px rgba(255, 255, 255, 0.2)'
                        : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
            >
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                Your Application
                            </h2>
                            <p className="text-sm mt-1 line-clamp-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                {jobTitle}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-6 h-6" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
                    {loading ? (
                        <div className="text-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                            <p className="mt-4" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                Loading your application...
                            </p>
                        </div>
                    ) : !application ? (
                        <div className="text-center py-12">
                            <User className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
                            <p className="text-lg font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                Application not found
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Status Badge */}
                            <div className="flex items-center justify-between">
                                <span
                                    className="px-4 py-2 rounded-full text-sm font-medium"
                                    style={{
                                        backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                                        color: isDark ? '#93c5fd' : '#1e40af',
                                    }}
                                >
                                    {application.status}
                                </span>
                                <div className="flex items-center gap-2 text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                    <Clock className="w-4 h-4" />
                                    Applied {formatTimeAgo(application.appliedAt)}
                                </div>
                            </div>

                            {/* Job Poster Info with Chat Button */}
                            <div
                                className="p-4 rounded-xl border"
                                style={{
                                    backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                }}
                            >
                                <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    Job Posted By
                                </h3>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {/* Avatar + Name (clickable) */}
                                    <button
                                        type="button"
                                        onClick={() => setViewingProfileId(jobPosterId)}
                                        className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
                                    >
                                        {jobPosterAvatar ? (
                                            <img
                                                src={jobPosterAvatar}
                                                alt={jobPosterName}
                                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                                style={{ border: `2px solid ${isDark ? '#3a3a3a' : '#e5e7eb'}` }}
                                            />
                                        ) : (
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                                                style={{ backgroundColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#ffffff' : '#374151' }}
                                            >
                                                {(livePosterName || jobPosterName)?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        <div className="text-left min-w-0">
                                            <p className="font-semibold truncate" style={{ color: isDark ? '#ffffff' : '#111827' }}>{livePosterName || jobPosterName}</p>
                                            <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Tap to view profile</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => pushChatState({
                                            jobId,
                                            jobTitle,
                                            otherUserId: jobPosterId,
                                            otherUserName: livePosterName || jobPosterName,
                                            otherUserEmail: jobPosterEmail,
                                            otherUserPhone: jobPosterPhone,
                                        })}
                                        className="flex-shrink-0 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                                    >
                                        <MessageCircle className="w-4 h-4" />
                                        Chat
                                    </button>
                                </div>
                            </div>

                            {/* Budget Information */}
                            <div
                                className="p-4 rounded-xl border"
                                style={{
                                    backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                }}
                            >
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    <IndianRupee className="w-4 h-4" />
                                    Budget Details
                                </h3>
                                <div className="space-y-3">
                                    {/* Original Job Budget */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                            {application.budgetSatisfied || application.negotiationStatus === 'accepted'
                                                ? 'Initial Budget:'
                                                : 'Job Budget:'}
                                        </span>
                                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                            {jobBudget ? `₹${jobBudget.toLocaleString()}` : 'Not set'}
                                        </span>
                                    </div>

                                    {/* Final Agreed Budget - Only show if negotiation completed */}
                                    {(application.budgetSatisfied || application.negotiationStatus === 'accepted') &&
                                        application.currentOffer && application.currentOffer !== jobBudget && (
                                            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}>
                                                <span className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                    Final Agreed Budget:
                                                </span>
                                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                                                    ₹{application.currentOffer.toLocaleString()}
                                                </span>
                                            </div>
                                        )}

                                    <div className="flex items-center gap-2">
                                        {application.budgetSatisfied || application.negotiationStatus === 'accepted' ? (
                                            <>
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                    {application.negotiationHistory && application.negotiationHistory.length > 0
                                                        ? `Agreed on ₹${(application.currentOffer || jobBudget).toLocaleString()}`
                                                        : 'You accepted the offered budget'}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="w-5 h-5 text-orange-600" />
                                                <div className="flex-1">
                                                    <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                        Your Counter Offer:{' '}
                                                    </span>
                                                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                                        ₹{application.counterOffer?.toLocaleString() || 'N/A'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Renegotiation Actions - Show if poster made the last offer and not accepted */}
                                    {application.negotiationHistory && application.negotiationHistory.length > 0 &&
                                        application.offerBy === 'poster' && !application.budgetSatisfied &&
                                        application.negotiationStatus !== 'accepted' && (
                                            <div className="mt-4 space-y-3">
                                                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                                        Job poster offered ₹{application.currentOffer?.toLocaleString()}
                                                    </p>
                                                </div>

                                                {isNegotiating ? (
                                                    // Counter-offer Input
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                            Your Counter-Offer
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <div className="relative flex-1">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                    ₹
                                                                </span>
                                                                <input
                                                                    type="number"
                                                                    value={newOffer}
                                                                    onChange={(e) => setNewOffer(e.target.value)}
                                                                    placeholder="Enter amount"
                                                                    className="w-full pl-8 pr-4 py-2 rounded-lg border"
                                                                    style={{
                                                                        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                                                                        borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                                                        color: isDark ? '#ffffff' : '#111827'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>


                                                        {/* Reason field */}
                                                        <div className="mt-3">
                                                            <label className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                Reason (Optional)
                                                            </label>
                                                            <textarea
                                                                value={negotiationReason}
                                                                onChange={(e) => setNegotiationReason(e.target.value)}
                                                                placeholder="Why are you offering this amount?"
                                                                rows={2}
                                                                className="w-full px-3 py-2 mt-1 rounded-lg border resize-none"
                                                                style={{
                                                                    backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                                                                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                                                    color: isDark ? '#ffffff' : '#111827'
                                                                }}
                                                            />
                                                        </div>

                                                        <div className="flex gap-2 mt-3">
                                                            <button
                                                                onClick={handleSendCounterOffer}
                                                                disabled={responding}
                                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                            >
                                                                {responding ? 'Sending...' : 'Send'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setIsNegotiating(false)
                                                                    setNewOffer('')
                                                                    setNegotiationReason('')
                                                                }}
                                                                className="px-4 py-2 rounded-lg font-medium transition-colors"
                                                                style={{
                                                                    backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                                                                    color: isDark ? '#ffffff' : '#111827'
                                                                }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Action Buttons
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={handleAcceptOffer}
                                                            disabled={responding}
                                                            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                        >
                                                            {responding ? 'Processing...' : `Accept ₹${application.currentOffer?.toLocaleString()}`}
                                                        </button>
                                                        <button
                                                            onClick={() => setIsNegotiating(true)}
                                                            disabled={responding}
                                                            className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                        >
                                                            Counter-Offer
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    {/* Negotiation History */}
                                    {application.negotiationHistory && application.negotiationHistory.length > 0 && (
                                        <div className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}>
                                            <h5 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                Negotiation History
                                            </h5>
                                            <div className="space-y-2">
                                                {application.negotiationHistory.map((offer: any, index: number) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center gap-3 text-sm"
                                                    >
                                                        <div className={`w-2 h-2 rounded-full ${offer.offeredBy === 'applicant' ? 'bg-orange-600' : 'bg-blue-600'}`}></div>
                                                        <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                            {offer.offeredBy === 'applicant' ? 'You' : 'Job Poster'} offered
                                                        </span>
                                                        <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                            ₹{offer.amount.toLocaleString()}
                                                        </span>
                                                        {offer.message && (
                                                            <span className="text-xs italic" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                                - {offer.message}
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Application Description */}
                            {application.description && (
                                <div
                                    className="p-4 rounded-xl border"
                                    style={{
                                        backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                        borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                    }}
                                >
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                        Why You're Suitable
                                    </h3>
                                    <p
                                        className="text-sm leading-relaxed p-3 rounded-lg break-words overflow-wrap-anywhere"
                                        style={{
                                            backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                                            color: isDark ? '#d1d5db' : '#374151',
                                        }}
                                    >
                                        {application.description}
                                    </p>
                                    <p className="text-xs mt-2" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                        {application.description.length} characters
                                    </p>
                                </div>
                            )}

                            {/* Your Contact Info */}
                            <div
                                className="p-4 rounded-xl border"
                                style={{
                                    backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                }}
                            >
                                <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    Your Contact Information
                                </h3>
                                {/* Self Avatar + Name */}
                                <button
                                    type="button"
                                    onClick={() => user?.uid && setViewingProfileId(user.uid)}
                                    className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
                                >
                                    {selfAvatar ? (
                                        <img
                                            src={selfAvatar}
                                            alt={selfName}
                                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                            style={{ border: `2px solid ${isDark ? '#3a3a3a' : '#e5e7eb'}` }}
                                        />
                                    ) : (
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                                            style={{ backgroundColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#ffffff' : '#374151' }}
                                        >
                                            {(selfName || application.userEmail || '?')[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="text-left">
                                        <p className="font-semibold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                            {selfName || 'You'}
                                        </p>
                                        <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Tap to view profile</p>
                                    </div>
                                </button>
                                <div className="space-y-2">
                                    {application.userEmail && (
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {application.userEmail}
                                            </span>
                                        </div>
                                    )}
                                    {application.userPhone && (
                                        <div className="flex items-center gap-2">
                                            <Phone className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {application.userPhone.startsWith('+91') ? `+91 ${application.userPhone.slice(3)}` : application.userPhone}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ── Start Job — only for hired applicants ── */}
                            {application.status === 'hired' && (
                                <div
                                    className="p-4 rounded-xl border"
                                    style={{ backgroundColor: isDark ? '#2a2a2a' : '#f9fafb', borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}
                                >
                                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                        <Zap className="w-4 h-4 text-green-500" />
                                        Start Job
                                    </h3>

                                    {/* ── All post-start tracking phases ── */}
                                    {(['active', 'arrived', 'meeting_requested', 'meeting_code_pending', 'working', 'bill_submitted', 'bill_accepted', 'completed'] as string[]).includes(application.startJobStatus ?? '') && (
                                        <div className="space-y-3">

                                            {/* Phase: active — heading to client */}
                                            {application.startJobStatus === 'active' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-bold text-green-700 dark:text-green-400">Job is Active</p>
                                                            <p className="text-xs text-green-600 dark:text-green-500">Head to the client's location — we'll auto-detect when you arrive (within ~500m).</p>
                                                        </div>
                                                    </div>
                                                    {/* Manual fallback — in case GPS drift prevents auto-detection */}
                                                    {!application?.arrivalDetected && (
                                                        <button
                                                            onClick={() => {
                                                                if (!application?.id) return
                                                                arrivalNotifiedRef.current = true
                                                                notifyArrival(application.id, jobPosterId, jobTitle, application.userName || 'The worker', jobId).catch(console.error)
                                                            }}
                                                            className="w-full py-2.5 rounded-xl font-semibold text-sm border-2 transition-all flex items-center justify-center gap-2"
                                                            style={{ borderColor: '#f59e0b', color: '#d97706', background: 'transparent' }}
                                                        >
                                                            <MapPin className="w-4 h-4" />
                                                            I'm at the Location (Manual)
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Phase: arrived */}
                                            {application.startJobStatus === 'arrived' && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'linear-gradient(135deg,#f59e0b20,#f59e0b08)', border: '1px solid #f59e0b80' }}>
                                                        <MapPin className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-bold text-amber-700 dark:text-amber-300">You've Arrived!</p>
                                                            <p className="text-xs text-amber-600 dark:text-amber-400">Tap below to request meeting confirmation from the client.</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => requestMeeting(application.id).catch(console.error)}
                                                        className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                                                        style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                        Confirm I'm Here
                                                    </button>
                                                </div>
                                            )}

                                            {/* Phase: meeting_requested */}
                                            {application.startJobStatus === 'meeting_requested' && (
                                                <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: isDark ? '#1e1a00' : '#fefce8', border: '1px solid #fde68a' }}>
                                                    <Loader2 className="w-5 h-5 text-yellow-500 animate-spin flex-shrink-0" />
                                                    <div>
                                                        <p className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">Waiting for meeting code</p>
                                                        <p className="text-xs text-yellow-600 dark:text-yellow-500">The client will generate a 6-char code for you to enter.</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Phase: meeting_code_pending */}
                                            {application.startJobStatus === 'meeting_code_pending' && (
                                                <div className="space-y-3">
                                                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Enter the meeting code from client</p>
                                                        {meetingSecondsLeft > 0 ? (
                                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                                Expires in: <span className="font-bold">{Math.floor(meetingSecondsLeft / 60)}:{String(meetingSecondsLeft % 60).padStart(2, '0')}</span>
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs text-orange-500 mt-1">Code expired — client will send a new one</p>
                                                        )}
                                                    </div>
                                                    {meetingSecondsLeft > 0 && (
                                                        <div className="space-y-2">
                                                            <input
                                                                type="text" maxLength={6}
                                                                value={meetingEnteredCode}
                                                                onChange={e => setMeetingEnteredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                                placeholder="ABC123"
                                                                className="w-full px-4 py-3 rounded-xl border text-center font-mono font-bold tracking-widest outline-none"
                                                                style={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#fff' : '#111827', fontSize: 24 }}
                                                            />
                                                            <button
                                                                onClick={handleVerifyMeetingCode}
                                                                disabled={meetingCodeSubmitting || meetingEnteredCode.length !== 6}
                                                                className="w-full rounded-xl bg-green-600 disabled:bg-gray-400 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                                                style={{ minHeight: 48 }}
                                                            >
                                                                {meetingCodeSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4" />Verify Meeting Code</>}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Phase: working */}
                                            {application.startJobStatus === 'working' && (
                                                <div className="space-y-3">
                                                    {/* Bill rejection notice */}
                                                    {application.billStatus === 'rejected' && (
                                                        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: isDark ? '#2a0000' : '#fff0f0', border: '1px solid #fca5a5' }}>
                                                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <p className="font-bold text-sm text-red-600 dark:text-red-400">Previous bill was rejected</p>
                                                                <p className="text-xs text-red-500 mt-0.5">The client declined your last bill. Please review and create a new one with updated amounts.</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                                        <div>
                                                            <p className="font-bold text-green-700 dark:text-green-400">Meeting Confirmed — Job in Progress</p>
                                                            <p className="text-xs text-green-600 dark:text-green-500">Complete the job, then create a bill when done.</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowBillModal(true)}
                                                        className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                                                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                                    >
                                                        <Receipt className="w-4 h-4" />
                                                        {application.billStatus === 'rejected' ? 'Create New Bill' : 'Create Bill'}
                                                    </button>
                                                </div>
                                            )}

                                            {/* Phase: bill_submitted */}
                                            {application.startJobStatus === 'bill_submitted' && (
                                                <div className="space-y-2">
                                                    {application.billStatus === 'pending_review' && (
                                                        <>
                                                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: isDark ? '#1a1a00' : '#fefce8', border: '1px solid #fde68a' }}>
                                                                <Loader2 className="w-4 h-4 text-yellow-500 animate-spin flex-shrink-0" />
                                                                <div>
                                                                    <p className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">Bill in review — awaiting client approval</p>
                                                                    <p className="text-xs text-yellow-600">Amount: ₹{application.bill?.total?.toLocaleString('en-IN') ?? '–'}</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => setShowBillView(true)} className="w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors flex items-center justify-center gap-2" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                <Eye className="w-4 h-4" />View Submitted Bill
                                                            </button>
                                                        </>
                                                    )}
                                                    {application.billStatus === 'rejected' && (
                                                        <>
                                                            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: isDark ? '#2a0000' : '#fff0f0', border: '1px solid #fca5a5' }}>
                                                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                                <div>
                                                                    <p className="font-semibold text-sm text-red-600 dark:text-red-400">Bill rejected by client</p>
                                                                    <p className="text-xs text-red-500">Create a new bill with updated amounts.</p>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => setShowBillView(true)} className="w-full py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-2" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                                <Eye className="w-4 h-4" />View Rejected Bill
                                                            </button>
                                                            <button onClick={() => setShowBillModal(true)} className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                                                <Receipt className="w-4 h-4" />Create New Bill
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* Phase: bill_accepted / payment processing */}
                                            {application.startJobStatus === 'bill_accepted' && (
                                                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                                                    <div>
                                                        <p className="font-semibold text-sm text-blue-700 dark:text-blue-300">Payment processing…</p>
                                                        <p className="text-xs text-blue-600 dark:text-blue-400">Client is paying ₹{application.bill?.total?.toLocaleString('en-IN') ?? '–'}</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Phase: completed */}
                                            {application.startJobStatus === 'completed' && (
                                                <div className="space-y-3">
                                                    <div className="p-5 rounded-xl text-center space-y-2" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1))', border: '1px solid rgba(16,185,129,0.4)' }}>
                                                        <div className="flex justify-center"><IndianRupee className="w-10 h-10 text-green-500" /></div>
                                                        <p className="font-bold text-green-700 dark:text-green-400 text-lg">Payment Received!</p>
                                                        <p className="text-2xl font-black" style={{ color: isDark ? '#34d399' : '#059669' }}>₹{application.bill?.total?.toLocaleString('en-IN') ?? '–'}</p>
                                                        <p className="text-xs text-green-600 dark:text-green-500">Added to your wallet — check the Profile tab.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setShowPaidReceipt(true)}
                                                        className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                                                    >
                                                        <Receipt className="w-4 h-4" />
                                                        View Receipt & Export PDF
                                                    </button>
                                                </div>
                                            )}

                                            {/* GPS warning banner — tracking phases */}
                                            {(['active', 'arrived'] as string[]).includes(application.startJobStatus ?? '') && (
                                                <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: 'linear-gradient(135deg,#f59e0b22,#f59e0b11)', border: '1px solid #f59e0b44' }}>
                                                    <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Always keep your location ON for live tracking. Turning off GPS pauses tracking for the client.</p>
                                                </div>
                                            )}

                                            {/* Map toggle + LiveTrackingMap */}
                                            {(['active', 'arrived', 'meeting_requested'] as string[]).includes(application.startJobStatus ?? '') && (
                                                <>
                                                    <button
                                                        onClick={() => setShowTrackingMap(v => !v)}
                                                        className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
                                                        style={{ background: showTrackingMap ? (isDark ? '#1e3a8a' : '#dbeafe') : (isDark ? '#1a1a1a' : '#f3f4f6'), color: showTrackingMap ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#9ca3af' : '#6b7280') }}
                                                    >
                                                        <Map className="w-4 h-4" />
                                                        {showTrackingMap ? 'Hide Live Map' : 'View Live Tracking'}
                                                    </button>
                                                    {showTrackingMap && (
                                                        <LiveTrackingMap
                                                            workerLat={workerLocation?.lat ?? null}
                                                            workerLng={workerLocation?.lng ?? null}
                                                            locationUpdatedAt={workerLocation?.updatedAt ?? null}
                                                            destinationLat={jobDestination?.lat ?? null}
                                                            destinationLng={jobDestination?.lng ?? null}
                                                            role="worker" height={240} isDark={isDark}
                                                        />
                                                    )}
                                                </>
                                            )}

                                            {/* GPS denied popup — all tracking phases */}
                                            {gpsError && (['active', 'arrived', 'meeting_requested', 'meeting_code_pending', 'working'] as string[]).includes(application.startJobStatus ?? '') && (
                                                <div className="fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-6">
                                                    <div className="rounded-2xl p-6 max-w-sm w-full text-center space-y-4" style={{ backgroundColor: isDark ? '#1c1c1c' : '#ffffff' }}>
                                                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: '#fef3c7' }}>
                                                            <MapPin className="w-8 h-8 text-amber-500" />
                                                        </div>
                                                        <h3 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>Location Required</h3>
                                                        <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Enable GPS and allow location permission to continue job tracking.</p>
                                                        <p className="text-xs text-red-500 break-words">{gpsError}</p>
                                                        <button onClick={() => { setGpsError(null); if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null } }}
                                                            className="w-full py-3 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
                                                            Try Again
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}


                                    {/* Idle — request button */}
                                    {!application.startJobStatus && (
                                        <button
                                            onClick={handleRequestStart}
                                            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:shadow-lg"
                                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                        >
                                            <Play className="w-4 h-4" />
                                            Request to Start Job
                                        </button>
                                    )}

                                    {/* Waiting for poster */}
                                    {application.startJobStatus === 'requested' && (
                                        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6' }}>
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600 flex-shrink-0" />
                                            <div>
                                                <p className="font-semibold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>Waiting for client to accept…</p>
                                                <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>They'll generate a code once they accept.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Code entry */}
                                    {application.startJobStatus === 'code_pending' && secondsLeft > 0 && (
                                        <div className="space-y-3">
                                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                                                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">Enter the 6-digit code from the job poster</p>
                                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                                    Expires in: <span className="font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    value={enteredCode}
                                                    onChange={e => setEnteredCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                                    placeholder="ABC123"
                                                    className="w-full px-4 py-3 rounded-xl border text-center font-mono font-bold tracking-widest outline-none"
                                                    style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#ffffff' : '#111827', fontSize: 24 }}
                                                />
                                                <button
                                                    onClick={handleVerifyCode}
                                                    disabled={codeSubmitting || enteredCode.length !== 6}
                                                    className="w-full rounded-xl bg-green-600 disabled:bg-gray-400 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                                    style={{ minHeight: 48 }}
                                                >
                                                    {codeSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4" />Verify Code</>}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Code expired */}
                                    {application.startJobStatus === 'code_pending' && secondsLeft === 0 && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                            <XCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                            <p className="text-sm text-orange-600 dark:text-orange-400">Code expired — resetting… You can request again shortly.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        <>
            {createPortal(modalContent, document.body)}
            {viewingProfileId && (
                <UserProfileSheet userId={viewingProfileId} isDark={isDark} onClose={() => setViewingProfileId(null)} />
            )}
            {/* Bill create modal — portalled to body */}
            {showBillModal && createPortal(
                <JobBillModal
                    mode="create"
                    isDark={isDark}
                    onClose={() => setShowBillModal(false)}
                    onSubmitBill={handleSubmitBill}
                    jobTitle={jobTitle}
                />,
                document.body
            )}
            {/* Bill view modal (pending/rejected) — portalled to body */}
            {showBillView && application?.bill && createPortal(
                <JobBillModal
                    mode="view"
                    isDark={isDark}
                    onClose={() => setShowBillView(false)}
                    bill={application.bill as any}
                    billStatus={application.billStatus}
                    billRejectedAt={application.billRejectedAt}
                    jobTitle={jobTitle}
                />,
                document.body
            )}
            {/* Paid receipt modal (completed jobs) */}
            {showPaidReceipt && application?.bill && createPortal(
                <JobBillModal
                    mode="paid"
                    isDark={isDark}
                    onClose={() => setShowPaidReceipt(false)}
                    bill={application.bill as any}
                    jobTitle={jobTitle}
                    workerName={selfName || undefined}
                    clientName={livePosterName || jobPosterName}
                    paymentId={application.razorpayPaymentId}
                    paidAt={application.paidAt}
                />,
                document.body
            )}
            {/* Welcome animation overlay */}
            <AnimatePresence>
                {showWelcomeAnimation && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99997] flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.88)' }}
                    >
                        <div className="text-center p-8 max-w-xs">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ duration: 0.7, times: [0, 0.6, 1] }} className="text-7xl mb-4">🎉</motion.div>
                            <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="text-2xl font-black text-white mb-3">All the Best!</motion.h2>
                            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="text-gray-300 text-sm leading-relaxed">
                                Be nice, polite, and professional.Complete the job on time and give it your best. Good luck! 🌟
                            </motion.p>
                            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                                onClick={() => setShowWelcomeAnimation(false)}
                                className="mt-6 px-6 py-2.5 rounded-xl text-sm font-bold text-white border border-white/30 hover:bg-white/10 transition-colors"
                            >
                                Let's Go! 🚀
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
