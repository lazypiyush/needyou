'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, IndianRupee, MessageCircle, Loader2, MapPin, Wrench, Receipt, KeyRound, FileText, Map, Users } from 'lucide-react'
import { getJobApplications } from '@/lib/auth'
import { auth, db } from '@/lib/firebase'
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore'
import { useTheme } from 'next-themes'
import { renegotiateBudget } from '@/lib/renegotiation'
import UserProfileSheet from './UserProfileSheet'
import { getCompressedImageUrl, getAvatarImageUrl } from '@/lib/cloudinary'
import { useModalHistory } from '@/hooks/useModalHistory'
import { pushChatState } from '@/lib/chatNavigation'
import { acceptStartRequest } from '@/lib/startJob'
import { acceptMeetingRequest, rejectBill, acceptBillForPayment, completePayment, failPayment } from '@/lib/jobBilling'
import LiveTrackingMap from './LiveTrackingMap'
import JobBillModal from './JobBillModal'

interface JobApplicationsModalProps {
    jobId: string
    jobTitle: string
    jobBudget: number | null
    jobPosterId: string
    jobPosterName: string
    onClose: () => void
}

export default function JobApplicationsModal({ jobId, jobTitle, jobBudget, jobPosterId, jobPosterName, onClose }: JobApplicationsModalProps) {
    const { theme, systemTheme } = useTheme()
    const [applications, setApplications] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [viewingProfileId, setViewingProfileId] = useState<string | null>(null)

    // Back button closes this modal
    useModalHistory(true, onClose)

    // Renegotiation state
    const [negotiatingId, setNegotiatingId] = useState<string | null>(null)
    const [newOffer, setNewOffer] = useState<string>('')
    const [negotiationReason, setNegotiationReason] = useState<string>('')
    const [negotiating, setNegotiating] = useState(false)

    // Start Job poster state
    const [acceptingId, setAcceptingId] = useState<string | null>(null)
    const [tick, setTick] = useState(0)
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
    // Per-application map visibility toggle (client side)
    const [showMapForApps, setShowMapForApps] = useState<Record<string, boolean>>({})
    const [jobDestination, setJobDestination] = useState<{ lat: number; lng: number } | null>(null)
    // Bill review modal
    const [showBillReviewForApp, setShowBillReviewForApp] = useState<string | null>(null)
    const [showReceiptForApp, setShowReceiptForApp] = useState<string | null>(null)
    const [paymentLoading, setPaymentLoading] = useState<Record<string, boolean>>({})
    // Other Applications tab - only visible after someone is hired
    const [showOtherApps, setShowOtherApps] = useState(false)
    const [applicantNames, setApplicantNames] = useState<Record<string, string>>({})
    const [applicantPhotos, setApplicantPhotos] = useState<Record<string, string>>({})
    const [livePosterName, setLivePosterName] = useState<string>('')

    // Live-fetch job poster's aadhaarName
    useEffect(() => {
        if (!jobPosterId) return
        getDoc(doc(db, 'users', jobPosterId)).then(snap => {
            if (snap.exists()) {
                const d = snap.data()
                setLivePosterName(d['kycData.aadhaarName'] || d.kycData?.aadhaarName || '')
            }
        }).catch(() => { })
    }, [jobPosterId])

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Real-time listener so start-job requests show up instantly
    useEffect(() => {
        if (!db) return
        setLoading(true)
        const q = query(collection(db, 'job_applications'), where('jobId', '==', jobId))
        const unsub = onSnapshot(q, (snap) => {
            const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            setApplications(apps)
            setLoading(false)
            // Fetch aadhaarName + photoURL for each unique applicant in parallel
            const uniqueUserIds = [...new Set(apps.map((a: any) => a.userId).filter(Boolean))];
            void (async () => {
                await Promise.all(
                    uniqueUserIds.map(async (uid: string) => {
                        try {
                            const userSnap = await getDoc(doc(db, 'users', uid))
                            if (userSnap.exists()) {
                                const d = userSnap.data()
                                const name = d['kycData.aadhaarName'] || d.kycData?.aadhaarName || ''
                                const photo = d.photoURL || ''
                                setApplicantNames(prev => name ? { ...prev, [uid]: name } : prev)
                                setApplicantPhotos(prev => photo ? { ...prev, [uid]: photo } : prev)
                            }
                        } catch { }
                    })
                )
            })()
            // Start tick if any app has a pending code or meeting code
            const hasPending = apps.some((a: any) =>
                (a.startJobStatus === 'code_pending' && a.startJobCodeExpiry > Date.now()) ||
                (a.startJobStatus === 'meeting_code_pending' && a.meetingCodeExpiry > Date.now())
            )
            if (hasPending) {
                if (!tickRef.current) tickRef.current = setInterval(() => setTick(t => t + 1), 1000)
            } else {
                if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
            }
        })
        return () => {
            unsub()
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
        }
    }, [jobId])

    // Fetch job location for direction route
    useEffect(() => {
        if (!db || !jobId) return
        import('firebase/firestore').then(({ doc: d, getDoc }) => {
            getDoc(d(db!, 'jobs', jobId)).then(snap => {
                if (!snap.exists()) return
                const data = snap.data()
                if (data.location?.latitude != null && data.location?.longitude != null) {
                    setJobDestination({ lat: data.location.latitude, lng: data.location.longitude })
                }
            })
        })
    }, [jobId])

    const handleAcceptStart = async (app: any) => {
        try {
            setAcceptingId(app.id)
            await acceptStartRequest(app.id, jobId, jobTitle, app.userId, livePosterName || jobPosterName)
        } catch (err) {
            console.error(err)
            alert('Failed to accept start request. Please try again.')
        } finally {
            setAcceptingId(null)
        }
    }

    const handleAcceptMeetingRequest = async (app: any) => {
        try {
            setAcceptingId(app.id)
            await acceptMeetingRequest(app.id, jobId, jobTitle, app.userId, jobPosterName)
        } catch (err) {
            console.error(err)
            alert('Failed to generate meeting code.')
        } finally {
            setAcceptingId(null)
        }
    }

    const handleRejectBill = async (app: any) => {
        try {
            await rejectBill(app.id, app.userId, jobId, jobTitle, livePosterName || jobPosterName)
        } catch (err) {
            console.error(err)
            alert('Failed to reject bill.')
        }
    }

    const loadRazorpay = (): Promise<boolean> => new Promise((resolve) => {
        if ((window as any).Razorpay) { resolve(true); return }
        const s = document.createElement('script')
        s.src = 'https://checkout.razorpay.com/v1/checkout.js'
        s.onload = () => resolve(true)
        s.onerror = () => resolve(false)
        document.body.appendChild(s)
    })

    // ── Accept bill & open Razorpay directly with UPI intent flow ──────────────
    const handleAcceptBillAndPay = async (app: any) => {
        const total = app.bill?.total
        if (!total) return
        setPaymentLoading(prev => ({ ...prev, [app.id]: true }))

        // Helper: alert + cleanup on hard failure
        const fail = async (msg: string) => {
            alert(msg)
            await failPayment(app.id).catch(console.error)
            setPaymentLoading(prev => ({ ...prev, [app.id]: false }))
        }

        try {
            // Step 1: Create order
            let orderRes: Response
            try {
                orderRes = await fetch('/api/create-bill-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: total, applicationId: app.id })
                })
            } catch {
                await fail('No internet connection. Please check your network and try again.')
                return
            }
            const order = await orderRes.json()
            if (!order.orderId) {
                await fail(order.error || 'Could not create payment order. Please try again.')
                return
            }

            // Step 2: Mark bill accepted
            try {
                await acceptBillForPayment(app.id, order.orderId)
            } catch {
                await fail('Could not update payment status. Please try again.')
                return
            }

            // Step 3: Load Razorpay SDK
            const loaded = await loadRazorpay()
            if (!loaded) {
                await fail('Razorpay could not load. Check your connection and try again.')
                return
            }

            // Step 4: Open Razorpay with all payment methods
            // On Android, Razorpay's UPI section shows installed apps as intent buttons
            const rzp = new (window as any).Razorpay({
                key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
                amount: order.amount,
                currency: order.currency,
                name: 'NeedYou',
                description: `Payment for: ${jobTitle}`,
                order_id: order.orderId,
                prefill: { name: jobPosterName },
                theme: { color: '#6366f1' },
                modal: {
                    ondismiss: () => setPaymentLoading(prev => ({ ...prev, [app.id]: false }))
                },
                handler: async (response: any) => {
                    try {
                        const verifyRes = await fetch('/api/verify-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                razorpayOrderId: response.razorpay_order_id,
                                razorpayPaymentId: response.razorpay_payment_id,
                                razorpaySignature: response.razorpay_signature
                            })
                        })
                        const verification = await verifyRes.json()
                        if (!verification.valid) {
                            await fail('Payment signature invalid — contact support with ID: ' + response.razorpay_payment_id)
                            return
                        }
                        await completePayment(app.id, jobId, app.userId, total, response.razorpay_payment_id, livePosterName || jobPosterName, jobTitle)
                        setShowBillReviewForApp(null)
                        setPaymentLoading(prev => ({ ...prev, [app.id]: false }))
                    } catch (e) {
                        console.error('Payment completion error', e)
                        alert('Payment processed but confirmation failed. Contact support with ID: ' + response.razorpay_payment_id)
                        setPaymentLoading(prev => ({ ...prev, [app.id]: false }))
                    }
                },
            })
            rzp.open()

        } catch (err: any) {
            console.error('Unexpected payment error', err)
            await fail('An unexpected error occurred. Please try again.')
        }
    }

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

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id)
    }

    // Accept a counter-offer OR hire a budget-satisfied applicant directly.
    // After accepting, marks the job as 'filled' and closes all other applications.
    const handleHire = async (app: any, finalAmount?: number) => {
        if (!confirm(`Hire ${app.userName} for this job? This will close all other applications.`)) return
        try {
            setNegotiating(true)
            const amount = finalAmount ?? app.counterOffer ?? app.currentOffer ?? jobBudget

            const { doc, updateDoc, collection, getDocs, query, where, writeBatch } = await import('firebase/firestore')
            const { db } = await import('@/lib/firebase')
            const { createNotification } = await import('@/lib/notifications')

            // 1. Accept this application
            await updateDoc(doc(db, 'job_applications', app.id), {
                negotiationStatus: 'accepted',
                budgetSatisfied: true,
                status: 'hired',
                currentOffer: amount
            })

            // 2. Mark job as filled
            await updateDoc(doc(db, 'jobs', jobId), { status: 'filled' })

            // 3. Close all OTHER applications for this job
            const snap = await getDocs(query(collection(db, 'job_applications'), where('jobId', '==', jobId)))
            const batch = writeBatch(db)
            snap.forEach((d: any) => {
                if (d.id !== app.id) batch.update(d.ref, { status: 'closed' })
            })
            await batch.commit()

            // 4. Notify accepted applicant
            await createNotification({
                userId: app.userId,
                type: 'job_hired',
                title: 'You have been hired!',
                message: `You were hired by ${jobPosterName} for "${jobTitle}"${amount ? ` at ₹${amount.toLocaleString()}` : ''}. Tap to view your application.`,
                jobId,
                jobTitle,
                applicationId: app.id,
                amount: amount ?? 0,
                createdAt: Date.now(),
                read: false
            })

            const apps = await getJobApplications(jobId)
            setApplications(apps)
            alert(`✅ ${app.userName} hired! All other applications closed.`)
        } catch (error) {
            console.error('Error hiring applicant:', error)
            alert('Failed to hire applicant. Please try again.')
        } finally {
            setNegotiating(false)
        }
    }


    const handleSendRenegotiation = async (app: any) => {
        const offerAmount = parseFloat(newOffer)
        if (isNaN(offerAmount) || offerAmount <= 0) {
            alert('Please enter a valid amount')
            return
        }

        try {
            setNegotiating(true)
            await renegotiateBudget(
                app.id,
                jobId,
                jobTitle,
                offerAmount,
                negotiationReason || undefined
            )
            // Refresh applications
            const apps = await getJobApplications(jobId)
            setApplications(apps)
            setNegotiatingId(null)
            setNewOffer('')
            setNegotiationReason('')
            alert('Counter-offer sent!')
        } catch (error) {
            console.error('Error sending renegotiation:', error)
            alert('Failed to send counter-offer')
        } finally {
            setNegotiating(false)
        }
    }

    if (!mounted) return null

    // Only status==='hired' means hired. negotiationStatus==='accepted' means budget agreed, not hired yet.
    const hiredApp = applications.find((a: any) => a.status === 'hired')
    const isJobFilled = !!hiredApp
    const otherApps = applications.filter((a: any) => a.id !== hiredApp?.id)

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <div
                className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl"
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
                                Job Applications
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
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                            <p className="mt-4" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                Loading applications...
                            </p>
                        </div>
                    ) : applications.length === 0 ? (
                        <div className="text-center py-12">
                            <User className="w-16 h-16 mx-auto mb-4" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
                            <p className="text-lg font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                No applications yet
                            </p>
                            <p className="text-sm mt-2" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                When people apply to this job, they'll appear here
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">

                            {/* ── Hired banner — pinned at top when job is filled ── */}
                            {isJobFilled && hiredApp && (
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                                    style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.08))', border: '1.5px solid rgba(16,185,129,0.5)' }}>
                                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-green-700 dark:text-green-400">{applicantNames[hiredApp.userId] || hiredApp.userName} — Hired</p>
                                        <p className="text-xs text-green-600 dark:text-green-500">This applicant has been selected for the job</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-600 text-white">Hired</span>
                                </div>
                            )}

                            {/* ── Application list: hired first, then others ── */}
                            {/* Sort: hired app first, rest after; or flat list if not filled */}
                            {(isJobFilled
                                ? [hiredApp!, ...otherApps]  // hired pinned to top
                                : applications
                            ).map((app) => {
                                const isExpanded = expandedId === app.id
                                const isHiredCard = isJobFilled && app.id === hiredApp?.id
                                const isOtherCard = isJobFilled && !isHiredCard
                                // Other app cards now render in the dedicated section below (not here)
                                if (isOtherCard) return null

                                return (
                                    <div
                                        key={app.id}
                                        className={`rounded-xl border${isHiredCard ? '-2' : ''} overflow-hidden transition-all`}
                                        style={{
                                            backgroundColor: isHiredCard ? (isDark ? '#0f2a1f' : '#f0fdf4') : (isDark ? '#2a2a2a' : '#f9fafb'),
                                            borderColor: isHiredCard ? '#16a34a' : (isDark ? '#3a3a3a' : '#e5e7eb'),
                                        }}
                                    >
                                        {/* Main Info - Always Visible */}
                                        <div
                                            className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
                                            onClick={() => toggleExpand(app.id)}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        {/* Avatar — clickable to open profile */}
                                                        <button
                                                            type="button"
                                                            onClick={e => { e.stopPropagation(); setViewingProfileId(app.userId) }}
                                                            className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm border-2 border-blue-500/30 hover:ring-2 hover:ring-blue-400 transition-all"
                                                            style={{ backgroundColor: isDark ? '#2a2a2a' : '#eff6ff' }}
                                                            title="View profile"
                                                        >
                                                            {applicantPhotos[app.userId] ? (
                                                                <img src={getAvatarImageUrl(applicantPhotos[app.userId])} alt={applicantNames[app.userId] || app.userName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
                                                                    {(applicantNames[app.userId] || app.userName)?.[0]?.toUpperCase() || '?'}
                                                                </span>
                                                            )}
                                                        </button>
                                                        {/* Name + Chat button inline — no email/phone shown */}
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={e => { e.stopPropagation(); setViewingProfileId(app.userId) }}
                                                                className="font-semibold hover:underline text-left"
                                                                style={{ color: isDark ? '#ffffff' : '#111827' }}
                                                            >
                                                                {applicantNames[app.userId] || app.userName}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    pushChatState({
                                                                        jobId,
                                                                        jobTitle,
                                                                        otherUserId: app.userId,
                                                                        otherUserName: applicantNames[app.userId] || app.userName,
                                                                        otherUserEmail: app.userEmail,
                                                                        otherUserPhone: app.userPhone,
                                                                    })
                                                                }}
                                                                className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
                                                                title="Chat with applicant"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5 text-white" />
                                                            </button>
                                                        </div>

                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Clock className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                                            <span className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                                Applied {formatTimeAgo(app.appliedAt)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span
                                                        className="px-3 py-1 rounded-full text-xs font-medium"
                                                        style={{
                                                            backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                                                            color: isDark ? '#93c5fd' : '#1e40af',
                                                        }}
                                                    >
                                                        {app.status}
                                                    </span>
                                                    {/* ── Single hire button in header top-right ── */}
                                                    {!isJobFilled &&
                                                        app.status !== 'hired' &&
                                                        app.status !== 'closed' &&
                                                        (app.budgetSatisfied || app.negotiationStatus === 'accepted') && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleHire(app, app.currentOffer ?? app.counterOffer ?? jobBudget ?? undefined)
                                                                }}
                                                                disabled={negotiating}
                                                                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-full text-xs font-bold transition-colors flex items-center gap-1"
                                                            >
                                                                <CheckCircle className="w-3 h-3" />
                                                                {negotiating ? '...' : `Hire`}
                                                            </button>
                                                        )}
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                                                    ) : (
                                                        <ChevronDown className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div
                                                className="px-4 pb-4 pt-2 border-t space-y-4"
                                                style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}
                                            >
                                                {/* Budget Information */}
                                                <div>
                                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                        <IndianRupee className="w-4 h-4" />
                                                        Budget
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {/* Original Job Budget */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                {app.budgetSatisfied || app.negotiationStatus === 'accepted'
                                                                    ? 'Initial Budget:'
                                                                    : 'Job Budget:'}{' '}
                                                                <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                    {jobBudget ? `₹${jobBudget.toLocaleString()}` : 'Not set'}
                                                                </span>
                                                            </span>
                                                        </div>

                                                        {/* Final Agreed Budget - Only show if negotiation completed */}
                                                        {(app.budgetSatisfied || app.negotiationStatus === 'accepted') &&
                                                            app.currentOffer && app.currentOffer !== jobBudget && (
                                                                <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}>
                                                                    <span className="text-sm font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                        Final Agreed Budget:{' '}
                                                                        <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                                            ₹{app.currentOffer.toLocaleString()}
                                                                        </span>
                                                                    </span>
                                                                </div>
                                                            )}

                                                        <div className="flex items-center gap-2">
                                                            {app.budgetSatisfied ? (
                                                                <>
                                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                                        Satisfied with offered budget
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="w-5 h-5 text-orange-600" />
                                                                    <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                        {app.negotiationHistory && app.negotiationHistory.length > 0
                                                                            ? 'Current Offer:'
                                                                            : 'Counter Offer:'}{' '}
                                                                        <span className="font-bold text-orange-600 dark:text-orange-400">
                                                                            {(app.currentOffer || app.counterOffer)
                                                                                ? `₹${(app.currentOffer || app.counterOffer).toLocaleString()}`
                                                                                : 'Not provided'}
                                                                        </span>
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Budget Proposal Reason - Show if applicant provided one */}
                                                        {app.budgetProposalReason && (
                                                            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6' }}>
                                                                <p className="text-xs font-semibold mb-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                    Budget Proposal Reason:
                                                                </p>
                                                                <p className="text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                    {app.budgetProposalReason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ── Hired badge for accepted applicant ── */}
                                                        {app.status === 'hired' && (
                                                            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                                <CheckCircle className="w-4 h-4 text-green-600" />
                                                                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Hired</span>
                                                            </div>
                                                        )}

                                                        {/* ── Start Job (poster side) ── */}
                                                        {app.status === 'hired' && (() => {
                                                            const secondsLeft = app.startJobCodeExpiry
                                                                ? Math.max(0, Math.floor((app.startJobCodeExpiry - Date.now()) / 1000))
                                                                : 0
                                                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                                            void tick // subscribe to tick so countdown re-renders
                                                            return (
                                                                <div className="mt-3 space-y-2">
                                                                    {/* Active — show map */}
                                                                    {(['active', 'arrived', 'meeting_requested', 'meeting_code_pending', 'working', 'bill_submitted', 'bill_accepted', 'completed'] as string[]).includes(app.startJobStatus ?? '') && (
                                                                        <div className="space-y-2">

                                                                            {/* Phase: active */}
                                                                            {app.startJobStatus === 'active' && (
                                                                                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                                                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                                                    <span className="text-sm font-bold text-green-700 dark:text-green-400">Job started — worker is on the way</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Phase: arrived — notification only, no button yet */}
                                                                            {app.startJobStatus === 'arrived' && (
                                                                                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.5)' }}>
                                                                                    <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                                                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">Worker has arrived at your location</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Phase: meeting_requested */}
                                                                            {app.startJobStatus === 'meeting_requested' && (
                                                                                <button
                                                                                    onClick={() => handleAcceptMeetingRequest(app)}
                                                                                    disabled={acceptingId === app.id}
                                                                                    className="w-full py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all text-sm"
                                                                                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                                                                >
                                                                                    {acceptingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-4 h-4" />Generate Meeting Code</>}
                                                                                </button>
                                                                            )}

                                                                            {/* Phase: meeting_code_pending — show code */}
                                                                            {app.startJobStatus === 'meeting_code_pending' && app.meetingCode && (() => {
                                                                                const meetingSecs = app.meetingCodeExpiry ? Math.max(0, Math.floor((app.meetingCodeExpiry - Date.now()) / 1000)) : 0
                                                                                void tick
                                                                                return meetingSecs > 0 ? (
                                                                                    <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                                                                                        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-1">Share this meeting code with the worker:</p>
                                                                                        <p className="text-3xl font-mono font-bold tracking-widest text-indigo-800 dark:text-indigo-200 text-center py-2">{app.meetingCode}</p>
                                                                                        <p className="text-xs text-indigo-500 text-center">Expires in: <span className="font-bold">{Math.floor(meetingSecs / 60)}:{String(meetingSecs % 60).padStart(2, '0')}</span></p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                                                                        <XCircle className="w-4 h-4 text-orange-500" />
                                                                                        <span className="text-xs text-orange-600">Meeting code expired — tap below to resend</span>
                                                                                    </div>
                                                                                )
                                                                            })()}
                                                                            {app.startJobStatus === 'meeting_code_pending' && (() => {
                                                                                const meetingSecs = app.meetingCodeExpiry ? Math.max(0, Math.floor((app.meetingCodeExpiry - Date.now()) / 1000)) : 0
                                                                                void tick
                                                                                return meetingSecs === 0 ? (
                                                                                    <button onClick={() => handleAcceptMeetingRequest(app)} disabled={acceptingId === app.id} className="w-full py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                                                                                        {acceptingId === app.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><KeyRound className="w-3.5 h-3.5" />Resend Meeting Code</>}
                                                                                    </button>
                                                                                ) : null
                                                                            })()}

                                                                            {/* Phase: working */}
                                                                            {app.startJobStatus === 'working' && (
                                                                                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                                                                    <Wrench className="w-4 h-4 text-green-600" />
                                                                                    <span className="text-sm font-bold text-green-700 dark:text-green-400">Job in progress</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Phase: bill_submitted → review */}
                                                                            {app.startJobStatus === 'bill_submitted' && app.billStatus === 'pending_review' && (
                                                                                <div className="space-y-2">
                                                                                    <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.5)' }}>
                                                                                        <Receipt className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                                                        <div>
                                                                                            <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Bill received — ₹{app.bill?.total?.toLocaleString('en-IN') ?? '–'}</p>
                                                                                            <p className="text-xs text-amber-600">{(applicantNames[app.userId] || app.userName)?.split(' ')[0]} submitted a bill. Review and pay.</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <button onClick={() => setShowBillReviewForApp(app.id)} className="w-full py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}><FileText className="w-4 h-4" />Review &amp; Pay Bill</button>
                                                                                </div>
                                                                            )}
                                                                            {app.startJobStatus === 'bill_submitted' && app.billStatus === 'rejected' && (
                                                                                <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
                                                                                    <XCircle className="w-4 h-4 text-red-500" />
                                                                                    <span className="text-xs text-red-600 dark:text-red-400">Bill rejected — waiting for worker to create new bill</span>
                                                                                </div>
                                                                            )}

                                                                            {/* Phase: bill_accepted / payment processing */}
                                                                            {app.startJobStatus === 'bill_accepted' && app.paymentStatus !== 'completed' && (
                                                                                <div className="space-y-2">
                                                                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                                                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                                                                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Payment pending…</span>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => handleAcceptBillAndPay(app)}
                                                                                        disabled={paymentLoading[app.id]}
                                                                                        className="w-full py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                                                                                        style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
                                                                                    >
                                                                                        {paymentLoading[app.id] ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : ''} Pay ₹{app.bill?.total?.toLocaleString('en-IN') ?? '–'}
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            {/* Phase: completed */}
                                                                            {app.startJobStatus === 'completed' && (
                                                                                <div className="space-y-2">
                                                                                    <div className="p-3 rounded-lg" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1))', border: '1px solid rgba(16,185,129,0.4)' }}>
                                                                                        <div className="flex items-center justify-center gap-2 mb-1">
                                                                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                                                                            <p className="text-sm font-bold text-green-700 dark:text-green-400">Job Completed — Payment Sent</p>
                                                                                        </div>
                                                                                        <p className="text-xs text-green-600 text-center">₹{app.bill?.total?.toLocaleString('en-IN') ?? '–'} sent to worker&apos;s wallet</p>
                                                                                    </div>
                                                                                    <button
                                                                                        onClick={() => setShowReceiptForApp(app.id)}
                                                                                        className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
                                                                                        style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                                                                                    >
                                                                                        <Receipt className="w-4 h-4" />View Receipt &amp; Export PDF
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                            {/* Map toggle for tracking phases */}
                                                                            {(['active', 'arrived', 'meeting_requested'] as string[]).includes(app.startJobStatus ?? '') && (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => setShowMapForApps(prev => ({ ...prev, [app.id]: !prev[app.id] }))}
                                                                                        className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                                                                                        style={{ background: showMapForApps[app.id] ? (isDark ? '#1e3a8a' : '#dbeafe') : (isDark ? '#1a1a1a' : '#f3f4f6'), color: showMapForApps[app.id] ? (isDark ? '#93c5fd' : '#1d4ed8') : (isDark ? '#9ca3af' : '#6b7280') }}
                                                                                    ><Map className="w-3.5 h-3.5" />{showMapForApps[app.id] ? 'Hide Live Map' : 'View Live Tracking'}</button>
                                                                                    {showMapForApps[app.id] && (
                                                                                        <LiveTrackingMap
                                                                                            workerLat={app.workerLat ?? null} workerLng={app.workerLng ?? null}
                                                                                            locationUpdatedAt={app.locationUpdatedAt ?? null}
                                                                                            destinationLat={jobDestination?.lat ?? null} destinationLng={jobDestination?.lng ?? null}
                                                                                            role="client" height={220} isDark={isDark}
                                                                                        />
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* Start request received */}
                                                                    {app.startJobStatus === 'requested' && (
                                                                        <button
                                                                            onClick={() => handleAcceptStart(app)}
                                                                            disabled={acceptingId === app.id}
                                                                            className="w-full py-2 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all"
                                                                            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
                                                                        >
                                                                            {acceptingId === app.id
                                                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                                                : <><KeyRound className="w-4 h-4" />Accept Start Request — Generate Code</>}
                                                                        </button>
                                                                    )}
                                                                    {/* Code display */}
                                                                    {app.startJobStatus === 'code_pending' && app.startJobCode && secondsLeft > 0 && (
                                                                        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                                                                            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-1">Share this code with the applicant:</p>
                                                                            <p className="text-3xl font-mono font-bold tracking-widest text-indigo-800 dark:text-indigo-200 text-center py-2">
                                                                                {app.startJobCode}
                                                                            </p>
                                                                            <p className="text-xs text-indigo-500 dark:text-indigo-400 text-center">
                                                                                Expires in: <span className="font-bold">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {/* Code expired */}
                                                                    {app.startJobStatus === 'code_pending' && secondsLeft === 0 && (
                                                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                                                            <XCircle className="w-4 h-4 text-orange-500" />
                                                                            <span className="text-xs text-orange-600 dark:text-orange-400">Code expired — the applicant can request again.</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })()}

                                                        {/* ── Job filled — this applicant was not selected ── */}
                                                        {app.status === 'closed' && (
                                                            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6' }}>
                                                                <XCircle className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                                                <span className="text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Position filled by another applicant</span>
                                                            </div>
                                                        )}

                                                        {/* ── Action buttons — only if job not yet filled ── */}
                                                        {app.status !== 'hired' && app.status !== 'closed' && (() => {
                                                            const jobFilled = applications.some((a: any) => a.status === 'hired')
                                                            if (jobFilled) return null
                                                            return (
                                                                <>
                                                                    {/* Hire button for budget-satisfied applicants — now in card header, skip here */}

                                                                    {/* Renegotiation actions for counter-offer applicants */}
                                                                    {!app.budgetSatisfied && app.counterOffer &&
                                                                        (!app.offerBy || app.offerBy === 'applicant') &&
                                                                        app.negotiationStatus !== 'accepted' && (
                                                                            <div className="mt-4 space-y-3">
                                                                                {negotiatingId === app.id ? (
                                                                                    <div className="space-y-2">
                                                                                        <label className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Your Counter-Offer</label>
                                                                                        <div className="flex gap-2">
                                                                                            <div className="relative flex-1">
                                                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>₹</span>
                                                                                                <input
                                                                                                    type="number"
                                                                                                    value={newOffer}
                                                                                                    onChange={(e) => setNewOffer(e.target.value)}
                                                                                                    placeholder="Enter amount"
                                                                                                    className="w-full pl-8 pr-4 py-2 rounded-lg border"
                                                                                                    style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#ffffff' : '#111827' }}
                                                                                                />
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="mt-3">
                                                                                            <label className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Reason (Optional)</label>
                                                                                            <textarea
                                                                                                value={negotiationReason}
                                                                                                onChange={(e) => setNegotiationReason(e.target.value)}
                                                                                                placeholder="Why are you offering this amount?"
                                                                                                rows={2}
                                                                                                className="w-full px-3 py-2 mt-1 rounded-lg border resize-none"
                                                                                                style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#ffffff' : '#111827' }}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex gap-2 mt-3">
                                                                                            <button onClick={() => handleSendRenegotiation(app)} disabled={negotiating} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors">{negotiating ? 'Sending...' : 'Send'}</button>
                                                                                            <button onClick={() => { setNegotiatingId(null); setNewOffer(''); setNegotiationReason('') }} className="px-4 py-2 rounded-lg font-medium transition-colors" style={{ backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6', color: isDark ? '#ffffff' : '#111827' }}>Cancel</button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex gap-2">
                                                                                        <button
                                                                                            onClick={async () => {
                                                                                                if (!confirm(`Accept ₹${app.counterOffer.toLocaleString()} as the agreed price? You can then hire ${app.userName.split(' ')[0]} separately.`)) return
                                                                                                try {
                                                                                                    setNegotiating(true)
                                                                                                    const { respondToRenegotiation } = await import('@/lib/renegotiation')
                                                                                                    await respondToRenegotiation(app.id, jobId, jobTitle, auth.currentUser?.uid ?? '', true)
                                                                                                    const apps = await getJobApplications(jobId)
                                                                                                    setApplications(apps)
                                                                                                } catch (e: any) {
                                                                                                    alert(e.message || 'Failed to accept offer')
                                                                                                } finally {
                                                                                                    setNegotiating(false)
                                                                                                }
                                                                                            }}
                                                                                            disabled={negotiating}
                                                                                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                                                        >
                                                                                            {negotiating ? 'Accepting...' : `Agree ₹${app.counterOffer.toLocaleString()}`}
                                                                                        </button>
                                                                                        <button onClick={() => setNegotiatingId(app.id)} disabled={negotiating} className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors">
                                                                                            Renegotiate
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                </>
                                                            )
                                                        })()}


                                                        {/* Negotiation History */}
                                                        {app.negotiationHistory && app.negotiationHistory.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}>
                                                                <h5 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                    Negotiation History
                                                                </h5>
                                                                <div className="space-y-2">
                                                                    {app.negotiationHistory.map((offer: any, index: number) => (
                                                                        <div
                                                                            key={index}
                                                                            className="flex items-center gap-3 text-sm"
                                                                        >
                                                                            <div className={`w-2 h-2 rounded-full ${offer.offeredBy === 'poster' ? 'bg-blue-600' : 'bg-orange-600'}`}></div>
                                                                            <span style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                                {offer.offeredBy === 'poster' ? 'You' : 'Applicant'} offered
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
                                                {app.description && (
                                                    <div>
                                                        <h4 className="text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                            Why They're Suitable
                                                        </h4>
                                                        <p
                                                            className="text-sm leading-relaxed p-3 rounded-lg break-words overflow-wrap-anywhere"
                                                            style={{
                                                                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                                                                color: isDark ? '#d1d5db' : '#374151',
                                                            }}
                                                        >
                                                            {app.description}
                                                        </p>
                                                        <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                            {app.description.length} characters
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                        }
                                    </div>
                                )
                            })}

                            {/* ── Other Applications tab — only after hire ── */}
                            {/* ── Other Applications tab — button first, then expanded cards below ── */}
                            {isJobFilled && otherApps.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setShowOtherApps(v => !v)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all"
                                        style={{
                                            backgroundColor: showOtherApps ? (isDark ? '#1e1e2e' : '#eff6ff') : (isDark ? '#1a1a1a' : '#f9fafb'),
                                            borderColor: showOtherApps ? (isDark ? '#4b5cf6' : '#3b82f6') : (isDark ? '#2a2a2a' : '#e5e7eb'),
                                            color: isDark ? '#9ca3af' : '#6b7280',
                                        }}
                                    >
                                        <span className="text-sm font-semibold flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Other Applications
                                            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                                                style={{ backgroundColor: isDark ? '#2a2a2a' : '#e5e7eb', color: isDark ? '#d1d5db' : '#374151' }}>
                                                {otherApps.length}
                                            </span>
                                        </span>
                                        {showOtherApps
                                            ? <ChevronUp className="w-4 h-4" />
                                            : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    {/* Other app cards render BELOW the button when open */}
                                    {showOtherApps && otherApps.map((app: any) => {
                                        const isExpanded = expandedId === app.id
                                        return (
                                            <div
                                                key={app.id + '-other'}
                                                className="rounded-xl border overflow-hidden transition-all"
                                                style={{
                                                    backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                                    borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
                                                }}
                                            >
                                                <div
                                                    className="p-4 cursor-pointer hover:bg-opacity-80 transition-colors"
                                                    onClick={() => setExpandedId(isExpanded ? null : app.id)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm"
                                                                style={{ backgroundColor: isDark ? '#3a3a3a' : '#e5e7eb', color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                {applicantPhotos[app.userId]
                                                                    ? <img src={getAvatarImageUrl(applicantPhotos[app.userId])} alt={applicantNames[app.userId] || app.userName} className="w-full h-full object-cover" />
                                                                    : (applicantNames[app.userId] || app.userName)?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-semibold" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>{applicantNames[app.userId] || app.userName}</p>
                                                                <p className="text-xs" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Applied {new Date(app.appliedAt).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                                style={{ backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6', color: isDark ? '#6b7280' : '#9ca3af' }}>
                                                                {app.status === 'closed' ? 'Closed' : 'Pending'}
                                                            </span>
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </div>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb' }}>
                                                        {app.coverLetter && <p className="text-sm pt-3" style={{ color: isDark ? '#d1d5db' : '#374151' }}>{app.coverLetter}</p>}
                                                        {app.counterOffer && <p className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Their offer: <span className="font-bold text-orange-500">₹{app.counterOffer.toLocaleString()}</span></p>}
                                                        <div className="flex items-center gap-2 p-2 mt-2 rounded-lg" style={{ backgroundColor: isDark ? '#1a1a1a' : '#f3f4f6' }}>
                                                            <XCircle className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                                            <span className="text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Position filled by another applicant</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div >
    )

    return (
        <>
            {createPortal(modalContent, document.body)}
            {viewingProfileId && (
                <UserProfileSheet userId={viewingProfileId} isDark={isDark} onClose={() => setViewingProfileId(null)} />
            )}
            {/* Bill review modal — portalled to body so it's always on top */}
            {showBillReviewForApp && mounted && (() => {
                const app = applications.find((a: any) => a.id === showBillReviewForApp)
                if (!app) return null
                return createPortal(
                    <JobBillModal
                        mode="review"
                        isDark={isDark}
                        onClose={() => setShowBillReviewForApp(null)}
                        bill={app.bill}
                        billStatus={app.billStatus}
                        workerName={applicantNames[app.userId] || app.userName}
                        jobTitle={jobTitle}
                        onAccept={() => handleAcceptBillAndPay(app)}
                        onReject={() => handleRejectBill(app).then(() => setShowBillReviewForApp(null))}
                    />,
                    document.body
                )
            })()}
            {/* Paid receipt portal — view completed bill + PDF for client */}
            {(() => {
                const receiptApp = applications.find((a: any) => a.id === showReceiptForApp)
                if (!receiptApp || !receiptApp.bill) return null
                return createPortal(
                    <JobBillModal
                        mode="paid"
                        isDark={isDark}
                        onClose={() => setShowReceiptForApp(null)}
                        bill={receiptApp.bill}
                        jobTitle={jobTitle}
                        workerName={applicantNames[receiptApp.userId] || receiptApp.userName}
                        clientName={jobPosterName}
                        paymentId={receiptApp.razorpayPaymentId}
                        paidAt={receiptApp.paidAt}
                    />,
                    document.body
                )
            })()}
        </>
    )
}
