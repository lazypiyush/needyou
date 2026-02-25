'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Phone, Clock, CheckCircle, XCircle, IndianRupee, MessageCircle, Loader2 } from 'lucide-react'
import { getUserOwnApplication } from '@/lib/auth'
import { useTheme } from 'next-themes'
import { useAuth } from '@/context/AuthContext'
import ChatModal from './ChatModal'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { respondToRenegotiation } from '@/lib/renegotiation'
import { useModalHistory } from '@/hooks/useModalHistory'
import { useRouter } from 'next/navigation'

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
    const [showChat, setShowChat] = useState(false)
    const [jobPosterPhone, setJobPosterPhone] = useState<string | undefined>(undefined)

    // Back button closes modal
    useModalHistory(true, onClose)

    // Renegotiation state
    const [isNegotiating, setIsNegotiating] = useState(false)
    const [newOffer, setNewOffer] = useState<string>('')
    const [negotiationReason, setNegotiationReason] = useState<string>('')
    const [responding, setResponding] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    useEffect(() => {
        const fetchApplication = async () => {
            if (!user?.uid) return

            console.log('🔍 Fetching application for:', { jobId, userId: user.uid })
            try {
                const app = await getUserOwnApplication(jobId, user.uid)
                console.log('✅ Application data:', app)
                console.log('📊 Budget details:', {
                    budgetSatisfied: app?.budgetSatisfied,
                    negotiationStatus: app?.negotiationStatus,
                    currentOffer: app?.currentOffer,
                    counterOffer: app?.counterOffer,
                    jobBudget: jobBudget
                })
                setApplication(app)
            } catch (error) {
                console.error('❌ Error fetching application:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchApplication()
    }, [jobId, user?.uid])

    // Fetch job poster's phone number
    useEffect(() => {
        const fetchJobPosterPhone = async () => {
            if (!jobPosterId) return

            try {
                if (!db) {
                    console.error('Firestore not initialized')
                    return
                }

                const userDoc = await getDoc(doc(db, 'users', jobPosterId))
                if (userDoc.exists()) {
                    const userData = userDoc.data()
                    setJobPosterPhone(userData?.phoneNumber)
                }
            } catch (error) {
                console.error('Error fetching job poster phone:', error)
            }
        }

        fetchJobPosterPhone()
    }, [jobPosterId])

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
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                            <span className="font-medium truncate" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                {jobPosterName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 flex-shrink-0" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                            <span className="text-sm truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {jobPosterEmail}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowChat(true)}
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
                                        className="text-sm leading-relaxed p-3 rounded-lg"
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
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        <>
            {createPortal(modalContent, document.body)}
            {showChat && (
                <ChatModal
                    jobId={jobId}
                    jobTitle={jobTitle}
                    otherUserId={jobPosterId}
                    otherUserName={jobPosterName}
                    otherUserEmail={jobPosterEmail}
                    otherUserPhone={jobPosterPhone}
                    onClose={() => setShowChat(false)}
                />
            )}
        </>
    )
}
