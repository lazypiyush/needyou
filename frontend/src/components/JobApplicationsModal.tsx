'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, User, Mail, Phone, Clock, ChevronDown, ChevronUp, CheckCircle, XCircle, IndianRupee, MessageCircle } from 'lucide-react'
import { getJobApplications } from '@/lib/auth'
import { useTheme } from 'next-themes'
import ChatModal from './ChatModal'

interface JobApplicationsModalProps {
    jobId: string
    jobTitle: string
    jobBudget: number
    onClose: () => void
}

export default function JobApplicationsModal({ jobId, jobTitle, jobBudget, onClose }: JobApplicationsModalProps) {
    const { theme, systemTheme } = useTheme()
    const [applications, setApplications] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [mounted, setMounted] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [chatWith, setChatWith] = useState<{ userId: string; userName: string; userEmail: string; userPhone?: string } | null>(null)

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

    if (!mounted) return null

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
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
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <User className="w-5 h-5 text-blue-600" />
                                                        <h3 className="font-semibold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                            {app.userName}
                                                        </h3>
                                                    </div>

                                                    <div className="space-y-1">
                                                        {app.userEmail && (
                                                            <div className="flex items-center gap-2">
                                                                <Mail className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                                                <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                    {app.userEmail}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {app.userPhone && (
                                                            <div className="flex items-center gap-2">
                                                                <Phone className="w-4 h-4" style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
                                                                <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                    {app.userPhone}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setChatWith({
                                                                            userId: app.userId,
                                                                            userName: app.userName,
                                                                            userEmail: app.userEmail,
                                                                            userPhone: app.userPhone
                                                                        })
                                                                    }}
                                                                    className="ml-2 p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 transition-colors"
                                                                    title="Chat with applicant"
                                                                >
                                                                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                                                                </button>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 mt-2">
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
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                                Job Budget:{' '}
                                                                <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                                    ₹{jobBudget?.toLocaleString() || 'N/A'}
                                                                </span>
                                                            </span>
                                                        </div>
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
                                                                        Counter Offer:{' '}
                                                                        <span className="font-bold text-orange-600 dark:text-orange-400">
                                                                            ₹{app.counterOffer?.toLocaleString() || 'N/A'}
                                                                        </span>
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
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
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        <>
            {createPortal(modalContent, document.body)}
            {chatWith && (
                <ChatModal
                    jobId={jobId}
                    jobTitle={jobTitle}
                    otherUserId={chatWith.userId}
                    otherUserName={chatWith.userName}
                    otherUserEmail={chatWith.userEmail}
                    otherUserPhone={chatWith.userPhone}
                    onClose={() => setChatWith(null)}
                />
            )}
        </>
    )
}
