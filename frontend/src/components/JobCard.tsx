'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { MapPin, User, Clock, DollarSign, Image as ImageIcon, Video, Trash2, Edit } from 'lucide-react'
import { Job, applyToJob, deleteJob } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import Image from 'next/image'

interface JobCardProps {
    job: Job
    onApply?: () => void
    onDelete?: () => void
    onEdit?: () => void
}

export default function JobCard({ job, onApply, onDelete, onEdit }: JobCardProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [applying, setApplying] = useState(false)
    const [applied, setApplied] = useState(job.applicants.includes(user?.uid || ''))
    const [deleting, setDeleting] = useState(false)

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const isOwnJob = user?.uid === job.userId

    const handleApply = async () => {
        if (!user || isOwnJob || applied) return

        setApplying(true)
        try {
            await applyToJob(job.id, user.uid)
            setApplied(true)
            onApply?.()
        } catch (error: any) {
            alert(error.message || 'Failed to apply')
        } finally {
            setApplying(false)
        }
    }

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

    return (
        <div
            className="rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border"
            style={{
                backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                borderColor: isDark ? '#2a2a2a' : '#e5e7eb',
            }}
        >
            {/* Media Section */}
            {job.media.length > 0 && (
                <div className="relative w-full h-48 bg-gray-200 dark:bg-gray-800">
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
                {/* Caption */}
                <p
                    className="text-base font-medium line-clamp-2"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                >
                    {job.caption}
                </p>

                {/* Budget - HIGHLIGHTED */}
                <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border-2 border-green-500/50">
                    <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        ₹{job.budget.toLocaleString()}
                    </span>
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    <MapPin className="w-4 h-4" />
                    <span>{job.location.city}, {job.location.state}</span>
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
                        <div className="flex gap-2">
                            <button
                                onClick={onEdit}
                                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                Edit
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleApply}
                            disabled={applying || applied}
                            className={`w-full py-3 font-bold rounded-xl transition-all ${applied
                                    ? 'bg-gray-400 dark:bg-gray-600 text-white cursor-not-allowed'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg text-white'
                                }`}
                        >
                            {applying ? 'Applying...' : applied ? '✓ Applied' : 'Apply Now →'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
