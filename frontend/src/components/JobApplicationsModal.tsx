'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, IndianRupee, MessageCircle } from 'lucide-react'
import { getJobApplications } from '@/lib/auth'
import { useTheme } from 'next-themes'
import { renegotiateBudget } from '@/lib/renegotiation'
import { useState as useReactState } from 'react'
import UserProfileSheet from './UserProfileSheet'
import { getCompressedImageUrl } from '@/lib/cloudinary'
import { useModalHistory } from '@/hooks/useModalHistory'
import { pushChatState } from '@/lib/chatNavigation'

interface JobApplicationsModalProps {
    jobId: string
    jobTitle: string
    jobBudget: number | null
    onClose: () => void
}

export default function JobApplicationsModal({ jobId, jobTitle, jobBudget, onClose }: JobApplicationsModalProps) {
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

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    useEffect(() => {
        const fetchApplications = async () => {
            try {
                const apps = await getJobApplications(jobId)
                setApplications(apps)
            } catch (error) {
                console.error('Error fetching applications:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchApplications()
    }, [jobId])

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

    const handleAcceptCounterOffer = async (app: any) => {
        try {
            setNegotiating(true)

            // Import updateDoc and doc from firebase
            const { doc, updateDoc } = await import('firebase/firestore')
            const { db } = await import('@/lib/firebase')
            const { createNotification } = await import('@/lib/notifications')

            // Update application to accepted status
            const applicationRef = doc(db, 'job_applications', app.id)
            await updateDoc(applicationRef, {
                negotiationStatus: 'accepted',
                budgetSatisfied: true,
                currentOffer: app.counterOffer
            })

            // Create notification for applicant
            await createNotification({
                userId: app.userId,
                type: 'budget_accepted',
                title: 'Offer Accepted!',
                message: `Job poster accepted your offer of ₹${app.counterOffer.toLocaleString()} for "${jobTitle}"`,
                jobId,
                jobTitle,
                applicationId: app.id,
                amount: app.counterOffer,
                createdAt: Date.now(),
                read: false
            })

            // Refresh applications
            const apps = await getJobApplications(jobId)
            setApplications(apps)
            alert('Counter-offer accepted!')
        } catch (error) {
            console.error('Error accepting counter-offer:', error)
            alert('Failed to accept counter-offer')
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
                            <p className="text-sm font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                {applications.length} application{applications.length !== 1 ? 's' : ''}
                            </p>
                            {applications.map((app) => {
                                const isExpanded = expandedId === app.id
                                return (
                                    <div
                                        key={app.id}
                                        className="rounded-xl border overflow-hidden transition-all"
                                        style={{
                                            backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                            borderColor: isDark ? '#3a3a3a' : '#e5e7eb',
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
                                                            {app.userPhotoURL ? (
                                                                <img src={getCompressedImageUrl(app.userPhotoURL)} alt={app.userName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
                                                                    {app.userName?.[0]?.toUpperCase() || '?'}
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
                                                                {app.userName}
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    pushChatState({
                                                                        jobId,
                                                                        jobTitle,
                                                                        otherUserId: app.userId,
                                                                        otherUserName: app.userName,
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

                                                <div className="flex flex-col items-end gap-2">
                                                    <span
                                                        className="px-3 py-1 rounded-full text-xs font-medium"
                                                        style={{
                                                            backgroundColor: isDark ? '#1e3a8a' : '#dbeafe',
                                                            color: isDark ? '#93c5fd' : '#1e40af',
                                                        }}
                                                    >
                                                        {app.status}
                                                    </span>
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

                                                        {/* Renegotiation Actions - Only show if applicant made the last offer and not accepted */}
                                                        {!app.budgetSatisfied && app.counterOffer &&
                                                            (!app.offerBy || app.offerBy === 'applicant') &&
                                                            app.negotiationStatus !== 'accepted' && (
                                                                <div className="mt-4 space-y-3">
                                                                    {negotiatingId === app.id ? (
                                                                        // Renegotiation Input
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
                                                                                    onClick={() => handleSendRenegotiation(app)}
                                                                                    disabled={negotiating}
                                                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                                                >
                                                                                    {negotiating ? 'Sending...' : 'Send'}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setNegotiatingId(null)
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
                                                                                onClick={() => handleAcceptCounterOffer(app)}
                                                                                disabled={negotiating}
                                                                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                                            >
                                                                                {negotiating ? 'Processing...' : `Accept ₹${app.counterOffer.toLocaleString()}`}
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setNegotiatingId(app.id)}
                                                                                disabled={negotiating}
                                                                                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                                                                            >
                                                                                Renegotiate
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

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
                                                            className="text-sm leading-relaxed p-3 rounded-lg"
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
                <UserProfileSheet
                    userId={viewingProfileId}
                    isDark={isDark}
                    onClose={() => setViewingProfileId(null)}
                />
            )}
        </>
    )
}
