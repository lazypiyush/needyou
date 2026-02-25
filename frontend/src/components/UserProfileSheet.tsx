'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
    X, Star, GraduationCap, Briefcase, Building2,
    Calendar, User, Maximize2
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { getUserReviews, Review } from '@/lib/auth'
import { getCompressedImageUrl } from '@/lib/cloudinary'
import ImageViewerModal from './ImageViewerModal'
import { useModalHistory } from '@/hooks/useModalHistory'

interface UserProfileSheetProps {
    userId: string
    isDark: boolean
    onClose: () => void
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
    const px = size === 'md' ? 'w-4 h-4' : 'w-3 h-3'
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <Star
                    key={i}
                    className={`${px} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                />
            ))}
        </div>
    )
}

export default function UserProfileSheet({ userId, isDark, onClose }: UserProfileSheetProps) {
    const [mounted, setMounted] = useState(false)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [reviews, setReviews] = useState<Review[]>([])
    const [showPhotoViewer, setShowPhotoViewer] = useState(false)

    // Back button closes this sheet
    useModalHistory(true, onClose)

    useEffect(() => { setMounted(true) }, [])

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const snap = await getDoc(doc(db, 'users', userId))
                if (snap.exists()) setProfile(snap.data())
                const r = await getUserReviews(userId)
                setReviews(r)
            } catch (e) {
                console.error('UserProfileSheet load error:', e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [userId])

    if (!mounted) return null

    const textPri = isDark ? '#ffffff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'
    const cardBg = isDark ? '#2a2a2a' : '#f9fafb'
    const cardBorder = isDark ? '#3a3a3a' : '#e5e7eb'

    const avgRating = reviews.length
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0

    const content = (
        <div
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            onClick={onClose}
        >
            <div
                className="w-full sm:max-w-lg max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-2xl flex flex-col"
                style={{ backgroundColor: isDark ? '#1c1c1c' : '#ffffff' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                    <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b" style={{ borderColor: cardBorder }}>
                    <h2 className="text-lg font-bold" style={{ color: textPri }}>Applicant Profile</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5" style={{ color: textSec }} />
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1 p-5 space-y-5">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                            <p className="text-sm" style={{ color: textSec }}>Loading profile…</p>
                        </div>
                    ) : !profile ? (
                        <div className="text-center py-12">
                            <User className="w-12 h-12 mx-auto mb-3" style={{ color: textSec }} />
                            <p style={{ color: textSec }}>Profile not found.</p>
                        </div>
                    ) : (
                        <>
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-4">
                                <div className="relative flex-shrink-0">
                                    {/* Avatar — compressed thumbnail, tap to view full-res */}
                                    <div
                                        className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold border-2 border-blue-500/30"
                                        style={{ backgroundColor: isDark ? '#2a2a2a' : '#eff6ff' }}
                                    >
                                        {profile.photoURL ? (
                                            <img
                                                src={getCompressedImageUrl(profile.photoURL)}
                                                alt={profile.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <span style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
                                                {profile.name?.[0]?.toUpperCase() || '?'}
                                            </span>
                                        )}
                                    </div>
                                    {/* Tap-to-expand overlay button */}
                                    {profile.photoURL && (
                                        <button
                                            onClick={() => setShowPhotoViewer(true)}
                                            className="absolute inset-0 rounded-full flex items-end justify-end p-0.5"
                                            title="View full photo"
                                        >
                                            <span className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                                                <Maximize2 className="w-3 h-3 text-white" />
                                            </span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-xl font-bold truncate" style={{ color: textPri }}>{profile.name || 'Unknown'}</h3>
                                    {profile.createdAt && (
                                        <p className="text-xs mt-0.5" style={{ color: textSec }}>
                                            Member since {new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                                        </p>
                                    )}
                                    {reviews.length > 0 && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <StarRating rating={avgRating} size="sm" />
                                            <span className="text-sm font-semibold" style={{ color: textPri }}>{avgRating.toFixed(1)}</span>
                                            <span className="text-xs" style={{ color: textSec }}>({reviews.length})</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* About Me */}
                            {profile.aboutMe && (
                                <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPri }}>
                                        <User className="w-4 h-4 text-blue-500" /> About
                                    </h4>
                                    <p className="text-sm leading-relaxed" style={{ color: textPri }}>{profile.aboutMe}</p>
                                </div>
                            )}

                            {/* Education */}
                            {profile.education?.degree && (
                                <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPri }}>
                                        <GraduationCap className="w-4 h-4 text-blue-500" /> Education
                                    </h4>
                                    <p className="font-medium text-sm" style={{ color: textPri }}>{profile.education.degree}</p>
                                    {profile.education.fieldOfStudy && (
                                        <p className="text-sm" style={{ color: textSec }}>{profile.education.fieldOfStudy}</p>
                                    )}
                                    {profile.education.institution && (
                                        <p className="text-xs mt-0.5" style={{ color: textSec }}>{profile.education.institution}</p>
                                    )}
                                    {profile.education.graduationYear && (
                                        <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: textSec }}>
                                            <Calendar className="w-3 h-3" /> Class of {profile.education.graduationYear}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Employment */}
                            {profile.employment?.status && (
                                <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPri }}>
                                        <Briefcase className="w-4 h-4 text-blue-500" /> Employment
                                    </h4>
                                    <p className="font-medium text-sm" style={{ color: textPri }}>{profile.employment.status}</p>
                                    {profile.employment.company && (
                                        <p className="text-sm flex items-center gap-1 mt-0.5" style={{ color: textSec }}>
                                            <Building2 className="w-3.5 h-3.5" /> {profile.employment.company}
                                        </p>
                                    )}
                                    {profile.employment.position && (
                                        <p className="text-xs mt-0.5" style={{ color: textSec }}>{profile.employment.position}</p>
                                    )}
                                    {profile.employment.experienceYears != null && (
                                        <p className="text-xs mt-0.5" style={{ color: textSec }}>
                                            {profile.employment.experienceYears} yr{profile.employment.experienceYears !== 1 ? 's' : ''} experience
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Reviews */}
                            {reviews.length > 0 && (
                                <div className="rounded-xl p-4 border" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: textPri }}>
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Reviews ({reviews.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {reviews.slice(0, 5).map(r => (
                                            <div key={r.id} className="rounded-lg p-3 border" style={{ backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderColor: isDark ? '#333' : '#f0f0f0' }}>
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <div>
                                                        <p className="font-medium text-xs" style={{ color: textPri }}>{r.reviewerName}</p>
                                                        <p className="text-xs" style={{ color: textSec }}>{r.jobTitle}</p>
                                                    </div>
                                                    <StarRating rating={r.rating} size="sm" />
                                                </div>
                                                {r.comment && (
                                                    <p className="text-xs mt-1 leading-relaxed" style={{ color: textSec }}>{r.comment}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )

    return (
        <>
            {createPortal(content, document.body)}
            {showPhotoViewer && profile?.photoURL && (
                <ImageViewerModal
                    media={[{ type: 'image', url: profile.photoURL }]}
                    initialIndex={0}
                    onClose={() => setShowPhotoViewer(false)}
                />
            )}
        </>
    )
}
