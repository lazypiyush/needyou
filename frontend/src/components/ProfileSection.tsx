'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    Camera, Star, GraduationCap, Briefcase, Building2,
    Calendar, LogOut, Save, Loader2, Check, AlertCircle,
    User, Mail, MapPin, Edit3, X, Award, Wallet
} from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { signOut } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import {
    updateUserProfile, getUserReviews, Review,
    updateUserEducation, updateUserEmployment
} from '@/lib/auth'
import { uploadToCloudinary, getCompressedImageUrl } from '@/lib/cloudinary'
import ImageViewerModal from '@/components/ImageViewerModal'
import WalletModal from '@/components/WalletModal'
import { AnimatePresence } from 'framer-motion'
import { Maximize2 } from 'lucide-react'

interface Props {
    user: { uid: string; email?: string | null; displayName?: string | null }
    isDark: boolean
}

const educationLevels = [
    'High School (10th)', 'Higher Secondary (11th-12th)', 'Associate Degree',
    "Bachelor's Degree", "Master's Degree", 'Doctoral Degree (PhD)',
    'Professional Degree', 'Diploma/Certificate', 'Other'
]
const employmentStatuses = ['Employed', 'Self-Employed', 'Freelancer', 'Student', 'Unemployed', 'Retired']

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
    const px = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
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

export default function ProfileSection({ user, isDark }: Props) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Profile data
    const [photoURL, setPhotoURL] = useState('')
    const [displayName, setDisplayName] = useState(user.displayName || '')
    const [aboutMe, setAboutMe] = useState('')
    const [editingAbout, setEditingAbout] = useState(false)
    const [aboutDraft, setAboutDraft] = useState('')
    const [memberSince, setMemberSince] = useState<number | null>(null)

    // Reviews
    const [reviews, setReviews] = useState<Review[]>([])
    const [loadingReviews, setLoadingReviews] = useState(false)

    // Edit form
    const [showEditForm, setShowEditForm] = useState(false)
    // Education
    const [degree, setDegree] = useState('')
    const [fieldOfStudy, setFieldOfStudy] = useState('')
    const [institution, setInstitution] = useState('')
    const [graduationYear, setGraduationYear] = useState('')
    // Employment
    const [employmentStatus, setEmploymentStatus] = useState('')
    const [company, setCompany] = useState('')
    const [position, setPosition] = useState('')
    const [experienceYears, setExperienceYears] = useState('')

    const [uploading, setUploading] = useState(false)
    const [savingAbout, setSavingAbout] = useState(false)
    const [savingForm, setSavingForm] = useState(false)
    const [formSuccess, setFormSuccess] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const [error, setError] = useState('')
    const [showPhotoViewer, setShowPhotoViewer] = useState(false)
    const [showWallet, setShowWallet] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)

    const needsCompany = ['Employed', 'Self-Employed'].includes(employmentStatus)

    // ── Fetch user data from Firestore ──────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid))
                if (snap.exists()) {
                    const d = snap.data()
                    setPhotoURL(d.photoURL || '')
                    setDisplayName(d.name || user.displayName || '')
                    setAboutMe(d.aboutMe || '')
                    setAboutDraft(d.aboutMe || '')
                    setMemberSince(d.createdAt || null)
                    setWalletBalance(d.walletBalance || 0)

                    // Pre-fill education
                    if (d.education) {
                        setDegree(d.education.degree || '')
                        setFieldOfStudy(d.education.fieldOfStudy || '')
                        setInstitution(d.education.institution || '')
                        setGraduationYear(d.education.graduationYear?.toString() || '')
                    }
                    // Pre-fill employment
                    if (d.employment) {
                        setEmploymentStatus(d.employment.status || '')
                        setCompany(d.employment.company || '')
                        setPosition(d.employment.position || '')
                        setExperienceYears(d.employment.experienceYears?.toString() || '')
                    }
                }
            } catch (e) {
                console.error('Profile load error:', e)
            }
        }
        load()
    }, [user.uid, user.displayName])

    // ── Real-time wallet balance listener ────────────────────────────────────
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
            if (snap.exists()) setWalletBalance(snap.data().walletBalance || 0)
        })
        return () => unsub()
    }, [user.uid])

    // ── Fetch reviews ────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setLoadingReviews(true)
            try {
                const r = await getUserReviews(user.uid)
                setReviews(r)
            } catch (e) {
                console.error('Reviews load error:', e)
            } finally {
                setLoadingReviews(false)
            }
        }
        load()
    }, [user.uid])

    // ── Photo upload ─────────────────────────────────────────────────────────
    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        setError('')
        try {
            const res = await uploadToCloudinary(file)
            await updateUserProfile(user.uid, { photoURL: res.secure_url })
            setPhotoURL(res.secure_url)
        } catch (err: any) {
            setError(err.message || 'Failed to upload photo')
        } finally {
            setUploading(false)
        }
    }

    // ── About Me save ────────────────────────────────────────────────────────
    const handleSaveAbout = async () => {
        setSavingAbout(true)
        setError('')
        try {
            await updateUserProfile(user.uid, { aboutMe: aboutDraft.trim() })
            setAboutMe(aboutDraft.trim())
            setEditingAbout(false)
        } catch (err: any) {
            setError(err.message || 'Failed to save')
        } finally {
            setSavingAbout(false)
        }
    }

    // ── Edit form save ───────────────────────────────────────────────────────
    const handleSaveForm = async (e: React.FormEvent) => {
        e.preventDefault()
        setSavingForm(true)
        setError('')
        setFormSuccess(false)
        try {
            await updateUserEducation(user.uid, {
                degree, fieldOfStudy, institution,
                graduationYear: parseInt(graduationYear)
            })
            await updateUserEmployment(user.uid, {
                status: employmentStatus,
                company: needsCompany ? company : null,
                position: needsCompany ? position : null,
                experienceYears: experienceYears ? parseInt(experienceYears) : null
            })
            setFormSuccess(true)
            setTimeout(() => { setFormSuccess(false); setShowEditForm(false) }, 1500)
        } catch (err: any) {
            setError(err.message || 'Failed to save')
        } finally {
            setSavingForm(false)
        }
    }

    // ── Logout ───────────────────────────────────────────────────────────────
    const handleLogout = async () => {
        setSigningOut(true)
        setError('')
        try {
            await signOut(auth)
            router.replace('/signin')
        } catch (err: any) {
            setError(err.message || 'Failed to sign out')
            setSigningOut(false)
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    const avgRating = reviews.length
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0

    const card = { backgroundColor: isDark ? '#1a1a1a' : '#ffffff', borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }
    const textPri = isDark ? '#ffffff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'
    const inputCls = `w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${isDark ? 'bg-[#2a2a2a] border-[#3a3a3a] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`
    const labelCls = `block text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`

    return (
        <div className="max-w-xl mx-auto space-y-5 pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

            {/* ── Error ── */}
            {error && (
                <div className="p-3 rounded-xl flex items-start gap-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
                    <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4 text-red-500" /></button>
                </div>
            )}

            {/* ── Avatar + Header ── */}
            <div className="rounded-2xl border p-6 flex flex-col items-center gap-3 text-center relative" style={card}>
                {/* Wallet Button — top right */}
                <button
                    onClick={() => setShowWallet(true)}
                    className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all hover:scale-105 active:scale-95"
                    style={{
                        backgroundColor: isDark ? '#1a2a1a' : '#f0fdf4',
                        borderColor: isDark ? '#166534' : '#86efac',
                        color: isDark ? '#4ade80' : '#16a34a',
                        boxShadow: isDark
                            ? '0 2px 10px rgba(74, 222, 128, 0.2), 0 1px 3px rgba(0,0,0,0.4)'
                            : '0 2px 10px rgba(22, 163, 74, 0.15), 0 1px 3px rgba(0,0,0,0.08)',
                    }}
                    title="Open Wallet"
                >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>₹{walletBalance.toLocaleString('en-IN')}</span>
                </button>
                {/* Avatar */}
                <div className="relative">
                    <div
                        className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold border-4 border-blue-500/30"
                        style={{ backgroundColor: isDark ? '#2a2a2a' : '#eff6ff' }}
                    >
                        {photoURL ? (
                            <img
                                src={getCompressedImageUrl(photoURL)}
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
                                {displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || '?'}
                            </span>
                        )}
                    </div>
                    {/* Tap avatar to view full-screen */}
                    {photoURL && (
                        <button
                            onClick={() => setShowPhotoViewer(true)}
                            className="absolute inset-0 rounded-full flex items-end justify-end p-0.5"
                            title="View full photo"
                        >
                            <span className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                <Maximize2 className="w-3.5 h-3.5 text-white" />
                            </span>
                        </button>
                    )}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
                    >
                        {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </div>

                <div>
                    <h2 className="text-xl font-bold" style={{ color: textPri }}>{displayName || 'No Name'}</h2>
                    <p className="text-sm mt-0.5" style={{ color: textSec }}>{user.email}</p>
                    {memberSince && (
                        <p className="text-xs mt-1" style={{ color: textSec }}>
                            Member since {new Date(memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </p>
                    )}
                </div>

                {/* Rating summary */}
                {reviews.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={avgRating} size="md" />
                        <span className="text-sm font-semibold" style={{ color: textPri }}>{avgRating.toFixed(1)}</span>
                        <span className="text-sm" style={{ color: textSec }}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                    </div>
                )}
            </div>

            {/* ── About Me ── */}
            <div className="rounded-2xl border p-5" style={card}>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: textPri }}>
                        <User className="w-4 h-4 text-blue-500" /> About Me
                    </h3>
                    {!editingAbout && (
                        <button
                            onClick={() => { setAboutDraft(aboutMe); setEditingAbout(true) }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                            <Edit3 className="w-4 h-4 text-blue-500" />
                        </button>
                    )}
                </div>

                {editingAbout ? (
                    <div className="space-y-3">
                        <textarea
                            value={aboutDraft}
                            onChange={e => setAboutDraft(e.target.value.slice(0, 200))}
                            rows={4}
                            placeholder="Tell others about yourself — your skills, experience, or what kind of work you do..."
                            className={`${inputCls} resize-none`}
                        />
                        <p className="text-xs text-right" style={{ color: textSec }}>{aboutDraft.length}/200</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setEditingAbout(false)}
                                className="flex-1 py-2 rounded-xl border font-medium text-sm transition-colors"
                                style={{ borderColor: isDark ? '#3a3a3a' : '#e5e7eb', color: textSec }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveAbout}
                                disabled={savingAbout}
                                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                {savingAbout ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm leading-relaxed" style={{ color: aboutMe ? textPri : textSec }}>
                        {aboutMe || 'Tap the edit icon to add a short bio…'}
                    </p>
                )}
            </div>

            {/* ── Ratings & Reviews ── */}
            <div className="rounded-2xl border p-5" style={card}>
                <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: textPri }}>
                    <Award className="w-4 h-4 text-blue-500" /> Ratings &amp; Reviews
                </h3>

                {loadingReviews ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                ) : reviews.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: textSec }}>
                        No reviews yet. Complete jobs to receive ratings.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {reviews.map(r => (
                            <div key={r.id} className="rounded-xl p-4 border" style={{ backgroundColor: isDark ? '#212121' : '#f9fafb', borderColor: isDark ? '#333' : '#f0f0f0' }}>
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <div>
                                        <p className="font-medium text-sm" style={{ color: textPri }}>{r.reviewerName}</p>
                                        <p className="text-xs" style={{ color: textSec }}>{r.jobTitle}</p>
                                    </div>
                                    <StarRating rating={r.rating} size="sm" />
                                </div>
                                {r.comment && (
                                    <p className="text-sm mt-2 leading-relaxed" style={{ color: textSec }}>{r.comment}</p>
                                )}
                                <p className="text-xs mt-2" style={{ color: isDark ? '#4b5563' : '#d1d5db' }}>
                                    {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Edit Profile Form ── */}
            <div className="rounded-2xl border overflow-hidden" style={card}>
                <button
                    onClick={() => setShowEditForm(v => !v)}
                    className="w-full flex items-center justify-between p-5"
                >
                    <h3 className="font-semibold flex items-center gap-2" style={{ color: textPri }}>
                        <Edit3 className="w-4 h-4 text-blue-500" /> Edit Profile
                    </h3>
                    <span style={{ color: textSec, fontSize: 13, transform: showEditForm ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {showEditForm && (
                    <form onSubmit={handleSaveForm} className="px-5 pb-5 space-y-5">
                        {/* Education */}
                        <div className="space-y-3 pt-2 border-t" style={{ borderColor: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                            <h4 className="text-sm font-semibold flex items-center gap-1.5 pt-2" style={{ color: textPri }}>
                                <GraduationCap className="w-4 h-4 text-blue-500" /> Education
                            </h4>

                            <div>
                                <label className={labelCls}>Highest Education Level</label>
                                <select value={degree} onChange={e => setDegree(e.target.value)} className={inputCls}>
                                    <option value="">Select level</option>
                                    {educationLevels.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className={labelCls}>Field of Study</label>
                                <input type="text" value={fieldOfStudy} onChange={e => setFieldOfStudy(e.target.value)} placeholder="e.g. Computer Science" className={inputCls} />
                            </div>

                            <div>
                                <label className={labelCls}>Institution</label>
                                <input type="text" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="e.g. University of Mumbai" className={inputCls} />
                            </div>

                            <div>
                                <label className={labelCls}>Graduation Year</label>
                                <input type="number" min="1950" max={new Date().getFullYear() + 10} value={graduationYear} onChange={e => setGraduationYear(e.target.value)} placeholder={new Date().getFullYear().toString()} className={inputCls} />
                            </div>
                        </div>

                        {/* Employment */}
                        <div className="space-y-3 pt-2 border-t" style={{ borderColor: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                            <h4 className="text-sm font-semibold flex items-center gap-1.5 pt-2" style={{ color: textPri }}>
                                <Briefcase className="w-4 h-4 text-blue-500" /> Employment
                            </h4>

                            <div>
                                <label className={labelCls}>Employment Status</label>
                                <select value={employmentStatus} onChange={e => setEmploymentStatus(e.target.value)} className={inputCls}>
                                    <option value="">Select status</option>
                                    {employmentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {needsCompany && (
                                <>
                                    <div>
                                        <label className={labelCls}><Building2 className="w-3.5 h-3.5 inline mr-1" />Company Name</label>
                                        <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google, Freelance" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Position / Role</label>
                                        <input type="text" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Software Engineer" className={inputCls} />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className={labelCls}><Calendar className="w-3.5 h-3.5 inline mr-1" />Years of Experience</label>
                                <input type="number" min="0" max="70" value={experienceYears} onChange={e => setExperienceYears(e.target.value)} placeholder="0" className={inputCls} />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={savingForm}
                            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                            style={{ background: formSuccess ? '#16a34a' : 'linear-gradient(to right, #2563eb, #4f46e5)' }}
                        >
                            {savingForm ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                            ) : formSuccess ? (
                                <><Check className="w-4 h-4" /> Saved!</>
                            ) : (
                                <><Save className="w-4 h-4" /> Save Changes</>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* Logout */}
            <button
                onClick={handleLogout}
                disabled={signingOut}
                className="w-full py-3.5 rounded-2xl border-2 border-red-500/40 font-semibold flex items-center justify-center gap-2 transition-all hover:bg-red-50 dark:hover:bg-red-900/10 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ color: '#ef4444' }}
            >
                {signingOut ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Signing out…</>
                ) : (
                    <><LogOut className="w-5 h-5" /> Sign Out</>
                )}
            </button>

            {/* Full-res profile photo viewer */}
            {showPhotoViewer && photoURL && (
                <ImageViewerModal
                    media={[{ type: 'image', url: photoURL }]}
                    initialIndex={0}
                    onClose={() => setShowPhotoViewer(false)}
                />
            )}

            {/* Wallet Modal */}
            <AnimatePresence>
                {showWallet && (
                    <WalletModal
                        isDark={isDark}
                        onClose={() => setShowWallet(false)}
                        balance={walletBalance}
                        uid={user.uid}
                        userName={user.displayName || user.email || ''}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
