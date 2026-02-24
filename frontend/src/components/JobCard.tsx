'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { MapPin, User, Clock, Image as ImageIcon, Video, Trash2, Users, ChevronDown, Languages } from 'lucide-react'
import { Job, applyToJob, deleteJob, checkIfUserApplied } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import Image from 'next/image'
import JobApplicationsModal from './JobApplicationsModal'
import ImageViewerModal from './ImageViewerModal'
import JobApplicationModal from './JobApplicationModal'
import ViewMyApplicationModal from './ViewMyApplicationModal'

interface JobCardProps {
    job: Job
    onApply?: () => void
    onDelete?: () => void
    userLocation?: { latitude: number; longitude: number } | null
    highlightJobId?: string | null
}

export default function JobCard({ job, onApply, onDelete, userLocation, highlightJobId }: JobCardProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [applied, setApplied] = useState(job.applicants.includes(user?.uid || ''))
    const [deleting, setDeleting] = useState(false)
    const [showApplications, setShowApplications] = useState(false)
    const [showImageViewer, setShowImageViewer] = useState(false)
    const [showApplicationModal, setShowApplicationModal] = useState(false)
    const [showMyApplication, setShowMyApplication] = useState(false)
    const [distance, setDistance] = useState<number | null>(null)
    const [captionExpanded, setCaptionExpanded] = useState(false)

    // Translation states
    const [isTranslated, setIsTranslated] = useState(false)
    const [translatedCaption, setTranslatedCaption] = useState('')
    const [isTranslating, setIsTranslating] = useState(false)
    const [isDetectingLanguage, setIsDetectingLanguage] = useState(false)
    const [detectedLanguage, setDetectedLanguage] = useState('')
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
    const [selectedLanguage, setSelectedLanguage] = useState('')

    // Check database for application status on mount and when job changes
    useEffect(() => {
        const checkApplicationStatus = async () => {
            if (user?.uid && job.id) {
                const hasApplied = await checkIfUserApplied(job.id, user.uid)
                // Only update if different to prevent overwriting manual state changes
                setApplied(prev => hasApplied || prev)
            }
        }
        checkApplicationStatus()
    }, [user?.uid, job.id])

    // Calculate distance when user location is available
    useEffect(() => {
        if (userLocation && job.location.latitude && job.location.longitude) {
            const { calculateDistance } = require('@/lib/distance')
            const dist = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                job.location.latitude,
                job.location.longitude
            )
            setDistance(dist)
        }
    }, [userLocation, job.location])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const isOwnJob = user?.uid === job.userId

    // Auto-open applications modal when highlighted from notification
    useEffect(() => {
        if (highlightJobId === job.id && isOwnJob) {
            setShowApplications(true)
        }
    }, [highlightJobId, job.id, isOwnJob])

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this job?')) return

        setDeleting(true)
        try {
            await deleteJob(job.id)
            onDelete?.()
        } catch (error: any) {
            alert(error.message || 'Failed to delete job')
        } finally {
            setDeleting(false)
        }
    }

    const getTimeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)
        if (seconds < 60) return 'Just now'
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    // Available languages for translation
    const languages = [
        'English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Kannada',
        'Malayalam', 'Bengali', 'Punjabi', 'Urdu', 'Spanish', 'French', 'German',
        'Chinese', 'Japanese', 'Korean', 'Arabic', 'Portuguese', 'Russian', 'Italian'
    ]

    // Detect language when user clicks Translate button
    const handleDetectLanguage = async () => {
        setIsDetectingLanguage(true)

        try {
            const response = await fetch('/api/translate/detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: job.caption })
            })

            if (!response.ok) {
                throw new Error('Language detection failed')
            }

            const data = await response.json()
            setDetectedLanguage(data.detectedLanguage)
            setShowLanguageDropdown(true)
        } catch (error) {
            console.error('Language detection error:', error)
            alert('Failed to detect language. Please try again.')
        } finally {
            setIsDetectingLanguage(false)
        }
    }

    const handleTranslate = async (targetLanguage: string) => {
        setIsTranslating(true)
        setSelectedLanguage(targetLanguage)

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: job.caption,
                    targetLanguage
                })
            })

            if (!response.ok) {
                throw new Error('Translation failed')
            }

            const data = await response.json()
            setTranslatedCaption(data.translatedText)
            setIsTranslated(true)
            setShowLanguageDropdown(false)
        } catch (error) {
            console.error('Translation error:', error)
            alert('Failed to translate. Please try again.')
        } finally {
            setIsTranslating(false)
        }
    }

    const handleShowOriginal = () => {
        setIsTranslated(false)
        setTranslatedCaption('')
        setShowLanguageDropdown(false)
        setSelectedLanguage('')
        setDetectedLanguage('')
    }

    // Filter out detected language from available languages
    const availableLanguages = detectedLanguage
        ? languages.filter(lang => lang.toLowerCase() !== detectedLanguage.toLowerCase())
        : languages

    const isHighlighted = highlightJobId === job.id

    return (
        <div
            className={`rounded-2xl overflow-hidden transition-all duration-300 border md:hover:scale-[1.02] ${isHighlighted ? 'ring-4 ring-blue-500 animate-pulse' : ''
                }`}
            style={{
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                borderColor: isHighlighted ? '#3b82f6' : (isDark ? '#2a2a2a' : '#e5e7eb'),
                boxShadow: isHighlighted
                    ? '0 20px 25px -5px rgba(59, 130, 246, 0.5), 0 8px 10px -6px rgba(59, 130, 246, 0.5)'
                    : (isDark
                        ? '0 10px 15px -3px rgba(255, 255, 255, 0.1), 0 4px 6px -4px rgba(255, 255, 255, 0.1)'
                        : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'),
            }}
            onMouseEnter={(e) => {
                // Only apply hover effects on devices with hover capability
                if (window.matchMedia('(hover: hover)').matches) {
                    if (isDark) {
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(255, 255, 255, 0.2), 0 8px 10px -6px rgba(255, 255, 255, 0.2)'
                    } else {
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                    }
                }
            }}
            onMouseLeave={(e) => {
                if (window.matchMedia('(hover: hover)').matches) {
                    if (isDark) {
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(255, 255, 255, 0.1), 0 4px 6px -4px rgba(255, 255, 255, 0.1)'
                    } else {
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'
                    }
                }
            }}
        >
            {/* Media Section */}
            {job.media.length > 0 && (
                <div
                    className="relative w-full bg-gray-200 dark:bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ aspectRatio: '3/2' }}
                    onClick={() => setShowImageViewer(true)}
                >
                    {job.media[0].type === 'image' ? (
                        <Image
                            src={job.media[0].url}
                            alt="Job media"
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="relative w-full h-full">
                            <video
                                src={job.media[0].url}
                                className="w-full h-full object-cover"
                                controls={false}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Video className="w-12 h-12 text-white" />
                            </div>
                        </div>
                    )}
                    {job.media.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" />
                            +{job.media.length - 1}
                        </div>
                    )}
                </div>
            )}

            {/* Content Section */}
            <div className="p-4 space-y-3">
                {/* Caption with Expand/Collapse */}
                <div className="relative">
                    <p
                        className={`text-base font-medium transition-all duration-300 ${captionExpanded ? '' : 'line-clamp-2'}`}
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                        {isTranslated ? translatedCaption : job.caption}
                    </p>
                    {/* Show expand button only if caption is long enough to be truncated */}
                    {(isTranslated ? translatedCaption.length : job.caption.length) > 100 && (
                        <button
                            onClick={() => setCaptionExpanded(!captionExpanded)}
                            className="mt-1 flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            aria-label={captionExpanded ? 'Collapse caption' : 'Expand caption'}
                        >
                            <span>{captionExpanded ? 'Show less' : 'Show more'}</span>
                            <ChevronDown
                                className={`w-4 h-4 transition-transform duration-300 ${captionExpanded ? 'rotate-180' : ''}`}
                            />
                        </button>
                    )}

                    {/* Translation Controls */}
                    <div className="mt-2 space-y-2">
                        {!isTranslated ? (
                            <>
                                <button
                                    onClick={handleDetectLanguage}
                                    disabled={isTranslating || isDetectingLanguage}
                                    className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                                >
                                    <Languages className="w-4 h-4" />
                                    <span>{isDetectingLanguage ? 'Detecting language...' : 'Translate'}</span>
                                </button>

                                {/* Language Dropdown */}
                                {showLanguageDropdown && (
                                    <div className="p-3 rounded-lg border" style={{
                                        backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                        borderColor: isDark ? '#3a3a3a' : '#e5e7eb'
                                    }}>
                                        {/* Show detected language */}
                                        {detectedLanguage && (
                                            <div className="mb-3 p-2 rounded-lg" style={{
                                                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                                                border: `1px solid ${isDark ? '#4a4a4a' : '#e5e7eb'}`
                                            }}>
                                                <p className="text-xs font-semibold mb-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                                    Detected Language:
                                                </p>
                                                <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                    {detectedLanguage}
                                                </p>
                                            </div>
                                        )}

                                        <p className="text-xs font-semibold mb-2" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                            Select target language:
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                            {availableLanguages.map((lang) => (
                                                <button
                                                    key={lang}
                                                    onClick={() => handleTranslate(lang)}
                                                    disabled={isTranslating}
                                                    className="px-3 py-2 text-sm font-medium rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                                                    style={{
                                                        backgroundColor: isDark ? '#3a3a3a' : '#ffffff',
                                                        color: isDark ? '#ffffff' : '#111827',
                                                        border: `1px solid ${isDark ? '#4a4a4a' : '#e5e7eb'}`
                                                    }}
                                                >
                                                    {isTranslating && selectedLanguage === lang ? 'Translating...' : lang}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleShowOriginal}
                                    className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                    <Languages className="w-4 h-4" />
                                    <span>Show Original</span>
                                </button>
                                {detectedLanguage && selectedLanguage && (
                                    <span className="text-xs px-2 py-1 rounded-full" style={{
                                        backgroundColor: isDark ? '#2a2a2a' : '#f3f4f6',
                                        color: isDark ? '#9ca3af' : '#6b7280'
                                    }}>
                                        {detectedLanguage} → {selectedLanguage}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Budget - HIGHLIGHTED */}
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-500/50">
                    {job.budgetNotSet || job.budget === null ? (
                        <span className="text-sm font-semibold" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                            Budget not set
                        </span>
                    ) : (
                        <span className="text-xl font-bold text-green-600 dark:text-green-400">
                            ₹{job.budget.toLocaleString()}
                        </span>
                    )}
                </div>

                {/* Location */}
                <div className="flex items-start gap-2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">
                        {job.location.detailedAddress ? (
                            <>
                                {job.location.detailedAddress}
                                {distance !== null && (
                                    <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                                        • {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                {job.location.area && `${job.location.area}, `}
                                {job.location.city}, {job.location.state}
                                {distance !== null && (
                                    <span className="ml-2 text-blue-600 dark:text-blue-400 font-medium">
                                        • {distance < 1 ? '< 1 km' : `${distance.toFixed(1)} km`}
                                    </span>
                                )}
                            </>
                        )}
                    </span>
                </div>

                {/* Posted By */}
                <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <User className="w-4 h-4" />
                    <span>Posted by {isOwnJob ? 'You' : job.userName}</span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <Clock className="w-4 h-4" />
                    <span>{getTimeAgo(job.createdAt)}</span>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 space-y-2">
                    {isOwnJob ? (
                        <div className="space-y-2">
                            {/* View Applications Button */}
                            <button
                                onClick={() => setShowApplications(true)}
                                className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Users className="w-4 h-4" />
                                View Applications ({job.applicants.length})
                            </button>


                            {/* Delete Button */}
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleting ? 'Deleting...' : 'Delete Job'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                console.log('🔘 Button clicked! Applied:', applied)
                                if (applied) {
                                    console.log('📱 Opening Review Application modal')
                                    setShowMyApplication(true)
                                } else {
                                    console.log('📝 Opening Apply modal')
                                    setShowApplicationModal(true)
                                }
                            }}
                            className={`w-full py-3 font-bold rounded-xl transition-all ${applied
                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 md:hover:shadow-lg text-white'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 md:hover:shadow-lg text-white'
                                }`}
                        >
                            {applied ? 'Review Application' : 'Apply Now →'}
                        </button>
                    )}
                </div>
            </div>

            {/* Applications Modal */}
            {showApplications && (
                <JobApplicationsModal
                    jobId={job.id}
                    jobTitle={job.caption}
                    jobBudget={job.budget}
                    onClose={() => setShowApplications(false)}
                />
            )}

            {/* Image Viewer Modal */}
            {showImageViewer && (
                <ImageViewerModal
                    media={job.media}
                    onClose={() => setShowImageViewer(false)}
                />
            )}

            {/* Job Application Modal */}
            {showApplicationModal && (
                <JobApplicationModal
                    job={{
                        id: job.id,
                        caption: job.caption,
                        budget: job.budget
                    }}
                    onClose={() => setShowApplicationModal(false)}
                    onSuccess={() => {
                        setApplied(true)
                        setShowApplicationModal(false)
                        onApply?.()
                    }}
                />
            )}

            {/* View My Application Modal */}
            {showMyApplication && (
                <ViewMyApplicationModal
                    jobId={job.id}
                    jobTitle={job.caption}
                    jobBudget={job.budget}
                    jobPosterName={job.userName}
                    jobPosterId={job.userId}
                    jobPosterEmail={job.userEmail}
                    onClose={() => setShowMyApplication(false)}
                />
            )}
        </div>
    )
}
