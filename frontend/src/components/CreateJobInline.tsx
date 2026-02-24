'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createJob, CreateJobData } from '@/lib/auth'
import { uploadToCloudinary, getVideoThumbnailUrl } from '@/lib/cloudinary'
import { Loader2, Upload, X, Video, MapPin } from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'

interface CreateJobInlineProps {
    onSuccess: () => void
}

export default function CreateJobInline({ onSuccess }: CreateJobInlineProps) {
    const { user } = useAuth()
    const { theme, resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    // ── All state hooks ───────────────────────────────────────────────────────
    const [caption, setCaption] = useState('')
    const [budget, setBudget] = useState('')
    const [budgetNotSet, setBudgetNotSet] = useState(false)
    const [mediaFiles, setMediaFiles] = useState<File[]>([])
    const [mediaPreviews, setMediaPreviews] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState('')
    const [userLocation, setUserLocation] = useState<any>(null)
    const [savedAddresses, setSavedAddresses] = useState<any[]>([])
    const [selectedAddressId, setSelectedAddressId] = useState<string>('')
    const [selectedAddress, setSelectedAddress] = useState<any>(null)

    // ── Effects ───────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return
        const fetchAddresses = async () => {
            try {
                const { getUserAddresses } = await import('@/lib/auth')
                const addresses = await getUserAddresses(user.uid)
                setSavedAddresses(addresses)
                const defaultAddr = addresses.find((addr: any) => addr.isDefault)
                const first = defaultAddr || addresses[0]
                if (first) {
                    setSelectedAddressId(first.id)
                    setSelectedAddress(first)
                    setUserLocation(first.location)
                }
            } catch (err) {
                console.error('Error fetching addresses:', err)
            }
        }
        fetchAddresses()
    }, [user])

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleAddressChange = (addressId: string) => {
        setSelectedAddressId(addressId)
        const selected = savedAddresses.find(addr => addr.id === addressId)
        if (selected) { setSelectedAddress(selected); setUserLocation(selected.location) }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (!files.length) return
        const validFiles: File[] = []
        const newPreviews: string[] = []
        files.forEach(file => {
            const isImage = file.type.startsWith('image/')
            const isVideo = file.type.startsWith('video/')
            if (!isImage && !isVideo) { alert(`${file.name} is not a valid image or video`); return }
            const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024
            if (file.size > maxSize) { alert(`${file.name} is too large. Max: ${isImage ? '10MB' : '50MB'}`); return }
            validFiles.push(file)
            newPreviews.push(URL.createObjectURL(file))
        })
        setMediaFiles(prev => [...prev, ...validFiles])
        setMediaPreviews(prev => [...prev, ...newPreviews])
    }

    const removeMedia = (index: number) => {
        URL.revokeObjectURL(mediaPreviews[index])
        setMediaFiles(prev => prev.filter((_, i) => i !== index))
        setMediaPreviews(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!caption.trim()) { setError('Please enter a caption'); return }

        let budgetNum: number | null = null
        if (!budgetNotSet) {
            budgetNum = parseFloat(budget)
            if (!budget || isNaN(budgetNum) || budgetNum <= 0) { setError('Please enter a valid budget'); return }
        }

        if (!userLocation) { setError('Location not found. Please update your profile.'); return }

        setUploading(true)
        setUploadProgress(0)

        try {
            const uploadedMedia: any[] = []
            for (let i = 0; i < mediaFiles.length; i++) {
                setUploadProgress(Math.round(((i + 1) / mediaFiles.length) * 100))
                const result = await uploadToCloudinary(mediaFiles[i])
                const item: any = { type: result.resource_type, url: result.secure_url, publicId: result.public_id }
                if (result.resource_type === 'video') item.thumbnailUrl = getVideoThumbnailUrl(result.public_id)
                uploadedMedia.push(item)
            }

            const cleanLocation = {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                city: userLocation.city || '',
                state: userLocation.state || '',
                country: userLocation.country || '',
                ...(userLocation.area && { area: userLocation.area }),
                ...(selectedAddress?.detailedAddress && {
                    detailedAddress: `${selectedAddress.houseNumber}, ${selectedAddress.detailedAddress}`
                })
            }

            const jobData: CreateJobData = {
                caption: caption.trim(),
                budget: budgetNum,
                budgetNotSet,
                media: uploadedMedia,
                location: cleanLocation,
            }

            await createJob(user!.uid, jobData)
            onSuccess()

        } catch (err: any) {
            console.error('Error creating job:', err)
            setError(err.message || 'Failed to create job')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-2xl mx-auto py-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                    Create New Job
                </h1>
                <p className="mt-1 text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                    Post a job and get help from nearby professionals
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div
                    className="p-6 rounded-2xl shadow-xl border"
                    style={{
                        backgroundColor: isDark ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.85)',
                        borderColor: isDark ? '#2a2a2a' : '#e5e7eb',
                        boxShadow: isDark ? '0 0 30px rgba(255,255,255,0.06)' : undefined
                    }}
                >
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Caption */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            Caption <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={caption}
                            onChange={e => setCaption(e.target.value)}
                            placeholder="Describe the job you need help with..."
                            rows={4}
                            required
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                            style={{ backgroundColor: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}
                        />
                    </div>

                    {/* Budget */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            Budget (₹) {!budgetNotSet && <span className="text-red-500">*</span>}
                        </label>
                        <div className="mb-3 flex items-center gap-2">
                            <input
                                type="checkbox" id="budgetNotSet" checked={budgetNotSet}
                                onChange={e => { setBudgetNotSet(e.target.checked); if (e.target.checked) setBudget('') }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="budgetNotSet" className="text-sm cursor-pointer" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                I don't know the budget yet
                            </label>
                        </div>
                        {!budgetNotSet && (
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">₹</span>
                                <input
                                    type="number" value={budget} onChange={e => setBudget(e.target.value)}
                                    placeholder="500" required min="1" step="1"
                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    style={{ backgroundColor: isDark ? '#2a2a2a' : '#ffffff', color: isDark ? '#ffffff' : '#111827' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Media Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            Photos/Videos (Optional)
                        </label>
                        <label className="block w-full p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                            style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }}>
                            <input type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" disabled={uploading} />
                            <div className="text-center">
                                <Upload className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                <p className="text-sm font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Click to upload or drag and drop</p>
                                <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Images (max 10MB) or Videos (max 50MB)</p>
                            </div>
                        </label>
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
                                        <button type="button" onClick={() => removeMedia(index)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Location Selector */}
                    {savedAddresses.length > 0 && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                Job Location <span className="text-red-500">*</span>
                            </label>
                            <div className="space-y-3">
                                {savedAddresses.map(addr => (
                                    <div key={addr.id} onClick={() => handleAddressChange(addr.id)}
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr.id
                                            ? 'border-blue-600'
                                            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
                                        style={{
                                            backgroundColor: selectedAddressId === addr.id
                                                ? (isDark ? 'rgba(37,99,235,0.1)' : 'rgba(219,234,254,1)')
                                                : (isDark ? '#2a2a2a' : '#ffffff')
                                        }}>
                                        <div className="flex items-start gap-3">
                                            <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${selectedAddressId === addr.id ? 'text-blue-600' : 'text-gray-400'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-base capitalize" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                                        {addr.label || addr.type}
                                                    </span>
                                                    {addr.isDefault && (
                                                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">DEFAULT</span>
                                                    )}
                                                </div>
                                                <p className="text-sm" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                                                    {addr.houseNumber}, {addr.detailedAddress}
                                                </p>
                                            </div>
                                            {selectedAddressId === addr.id && (
                                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upload Progress */}
                    {uploading && (
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>Uploading media...</span>
                                <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Submit */}
                    <button type="submit" disabled={uploading}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {uploading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" />Creating Job...</>
                        ) : (
                            <>Create Job →</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
