'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { createJob, CreateJobData } from '@/lib/auth'
import { uploadToCloudinary, CloudinaryUploadResponse, getVideoThumbnailUrl } from '@/lib/cloudinary'
import { Loader2, Upload, X, Image as ImageIcon, Video, DollarSign, MapPin } from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

export default function CreateJobPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    const [caption, setCaption] = useState('')
    const [budget, setBudget] = useState('')
    const [mediaFiles, setMediaFiles] = useState<File[]>([])
    const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState('')
    const [userLocation, setUserLocation] = useState<any>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Fetch user location
    useEffect(() => {
        const fetchUserLocation = async () => {
            if (user) {
                try {
                    const { db } = await import('@/lib/firebase')
                    const { doc, getDoc } = await import('firebase/firestore')
                    const userDoc = await getDoc(doc(db, 'users', user.uid))

                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        if (userData.location) {
                            setUserLocation(userData.location)
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user location:', error)
                }
            }
        }

        fetchUserLocation()
    }, [user])

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/signin')
        }
    }, [user, authLoading, router])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        // Validate file types and sizes
        const validFiles: File[] = []
        const newPreviews: string[] = []

        files.forEach((file) => {
            const isImage = file.type.startsWith('image/')
            const isVideo = file.type.startsWith('video/')

            if (!isImage && !isVideo) {
                alert(`${file.name} is not a valid image or video file`)
                return
            }

            const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024 // 10MB for images, 50MB for videos
            if (file.size > maxSize) {
                alert(`${file.name} is too large. Max size: ${isImage ? '10MB' : '50MB'}`)
                return
            }

            validFiles.push(file)
            newPreviews.push(URL.createObjectURL(file))
        })

        setMediaFiles([...mediaFiles, ...validFiles])
        setMediaPreviews([...mediaPreviews, ...newPreviews])
    }

    const removeMedia = (index: number) => {
        URL.revokeObjectURL(mediaPreviews[index])
        setMediaFiles(mediaFiles.filter((_, i) => i !== index))
        setMediaPreviews(mediaPreviews.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (!caption.trim()) {
            setError('Please enter a caption')
            return
        }

        const budgetNum = parseFloat(budget)
        if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
            setError('Please enter a valid budget')
            return
        }

        if (!userLocation) {
            setError('Location not found. Please update your profile.')
            return
        }

        setUploading(true)
        setUploadProgress(0)

        try {
            // Upload media files to Cloudinary
            const uploadedMedia: any[] = []

            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i]
                setUploadProgress(Math.round(((i + 1) / mediaFiles.length) * 100))

                const result = await uploadToCloudinary(file)

                uploadedMedia.push({
                    type: result.resource_type,
                    url: result.secure_url,
                    publicId: result.public_id,
                    thumbnailUrl: result.resource_type === 'video' ? getVideoThumbnailUrl(result.public_id) : undefined,
                })
            }

            // Create job data
            const jobData: CreateJobData = {
                caption: caption.trim(),
                budget: budgetNum,
                media: uploadedMedia,
                location: userLocation,
            }

            // Create job in Firestore
            await createJob(user!.uid, jobData)

            // Redirect to dashboard
            router.push('/dashboard')
        } catch (err: any) {
            console.error('Error creating job:', err)
            setError(err.message || 'Failed to create job')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    if (authLoading || !mounted) {
        return (
            <div
                className="min-h-screen w-full flex items-center justify-center"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))',
                }}
            >
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div
            className="min-h-screen w-full py-8 px-4"
            style={{
                background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))',
            }}
        >
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="text-blue-600 dark:text-blue-400 hover:underline mb-4"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1
                        className="text-3xl font-bold"
                        style={{ color: isDark ? '#ffffff' : '#111827' }}
                    >
                        Create New Job
                    </h1>
                    <p style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        Post a job and get help from nearby professionals
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div
                        className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-6 rounded-2xl shadow-xl border"
                        style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}
                    >
                        {error && (
                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Caption */}
                        <div className="mb-6">
                            <label
                                className="block text-sm font-medium mb-2"
                                style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                                Caption <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                placeholder="Describe the job you need help with..."
                                rows={4}
                                required
                                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white resize-none"
                            />
                        </div>

                        {/* Budget */}
                        <div className="mb-6">
                            <label
                                className="block text-sm font-medium mb-2"
                                style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                                Budget (₹) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={(e) => setBudget(e.target.value)}
                                    placeholder="500"
                                    required
                                    min="1"
                                    step="1"
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Media Upload */}
                        <div className="mb-6">
                            <label
                                className="block text-sm font-medium mb-2"
                                style={{ color: isDark ? '#ffffff' : '#111827' }}
                            >
                                Photos/Videos (Optional)
                            </label>

                            {/* Upload Area */}
                            <label
                                className="block w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                                style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }}
                            >
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    multiple
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    disabled={uploading}
                                />
                                <div className="text-center">
                                    <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                    <p className="text-sm font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                        Click to upload or drag and drop
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                        Images (max 10MB) or Videos (max 50MB)
                                    </p>
                                </div>
                            </label>

                            {/* Media Previews */}
                            {mediaPreviews.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                                    {mediaPreviews.map((preview, index) => (
                                        <div key={index} className="relative group">
                                            <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                                                {mediaFiles[index].type.startsWith('image/') ? (
                                                    <Image src={preview} alt={`Preview ${index + 1}`} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Video className="w-8 h-8 text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeMedia(index)}
                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Location Display */}
                        {userLocation && (
                            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                <span className="text-sm" style={{ color: isDark ? '#93c5fd' : '#1e40af' }}>
                                    {userLocation.city}, {userLocation.state}, {userLocation.country}
                                </span>
                            </div>
                        )}

                        {/* Upload Progress */}
                        {uploading && (
                            <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                        Uploading media...
                                    </span>
                                    <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                        {uploadProgress}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={uploading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Creating Job...
                                </>
                            ) : (
                                <>Create Job →</>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
