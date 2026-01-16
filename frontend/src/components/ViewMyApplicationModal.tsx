'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Phone, Clock, CheckCircle, XCircle, DollarSign, MessageCircle, Loader2 } from 'lucide-react'
import { getUserOwnApplication } from '@/lib/auth'
import { useTheme } from 'next-themes'
import { useAuth } from '@/context/AuthContext'
import ChatModal from './ChatModal'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

interface ViewMyApplicationModalProps {
    jobId: string
    jobTitle: string
    jobBudget: number
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

    if (!mounted) return null

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
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
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                {jobPosterName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Mail className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                {jobPosterEmail}
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowChat(true)}
                                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg text-white font-semibold rounded-xl transition-all flex items-center gap-2"
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
                                    <DollarSign className="w-4 h-4" />
                                    Budget Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                            Offered Budget:
                                        </span>
                                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                                            ₹{jobBudget.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {application.budgetSatisfied ? (
                                            <>
                                                <CheckCircle className="w-5 h-5 text-green-600" />
                                                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                                    You accepted the offered budget
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
                                                {application.userPhone}
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
