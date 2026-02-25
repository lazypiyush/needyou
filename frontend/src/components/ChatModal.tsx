'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Paperclip, Mic, Square, Loader2, Play, Trash2, Check, Phone, Camera, Image as ImageIcon, Video } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/context/AuthContext'
import { Message, subscribeToMessages, sendMessage, markMessagesAsRead, createOrGetConversation, sendMediaMessage, uploadChatMedia } from '@/lib/auth'
import Image from 'next/image'
import ImageViewerModal from './ImageViewerModal'
import MediaPreviewModal, { MediaItem } from './MediaPreviewModal'
import { getRotationCorrectedVideoUrl } from '@/lib/cloudinary'
import VideoViewerModal from './VideoViewerModal'
import { useModalHistory } from '@/hooks/useModalHistory'

interface ChatModalProps {
    jobId: string
    jobTitle: string
    otherUserId: string
    otherUserName: string
    otherUserEmail: string
    otherUserPhone?: string
    onClose: () => void
    /** When true, renders as a full-screen page (no portal/backdrop) — used by /dashboard/chat route */
    fullPage?: boolean
}

export default function ChatModal({
    jobId,
    jobTitle,
    otherUserId,
    otherUserName,
    otherUserEmail,
    otherUserPhone,
    onClose,
    fullPage = false
}: ChatModalProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [sending, setSending] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [conversationId, setConversationId] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [isRecording, setIsRecording] = useState(false)
    const [recordedAudio, setRecordedAudio] = useState<{ blob: Blob; url: string; duration: number } | null>(null)
    const [isPlayingPreview, setIsPlayingPreview] = useState(false)
    const [recordingDuration, setRecordingDuration] = useState(0)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [previewCurrentTime, setPreviewCurrentTime] = useState(0)
    const [playingMessageId, setPlayingMessageId] = useState<string | null>(null)
    const [messageCurrentTimes, setMessageCurrentTimes] = useState<Record<string, number>>({})
    const [selectedMedia, setSelectedMedia] = useState<MediaItem[]>([])
    const [showMediaPreview, setShowMediaPreview] = useState(false)
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const audioPreviewRef = useRef<HTMLAudioElement>(null)
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const recordingStartTimeRef = useRef<number>(0)
    const messageAudioRefs = useRef<Record<string, HTMLAudioElement>>({})

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    useEffect(() => {
        setMounted(true)
    }, [])

    // Back button closes modal (Android WebView)
    useModalHistory(!fullPage, onClose)

    // Create or get conversation
    useEffect(() => {
        const initConversation = async () => {
            if (user) {
                try {
                    const convId = await createOrGetConversation(
                        jobId,
                        jobTitle,
                        user.uid,
                        user.displayName || 'User',
                        user.email || '',
                        otherUserId,
                        otherUserName,
                        otherUserEmail
                    )
                    setConversationId(convId)
                } catch (error) {
                    console.error('Error creating conversation:', error)
                }
            }
        }
        initConversation()
    }, [user, jobId, jobTitle, otherUserId, otherUserName, otherUserEmail])

    // Subscribe to messages
    useEffect(() => {
        if (!conversationId || !user) return

        const unsubscribe = subscribeToMessages(conversationId, (msgs) => {
            setMessages(msgs)
            markMessagesAsRead(conversationId, user.uid)
        })

        return () => unsubscribe()
    }, [conversationId, user])

    // Auto-scroll to bottom (debounced for performance)
    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
        return () => clearTimeout(timer)
    }, [messages])

    // Auto-resize textarea (optimized)
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
        }
    }, [newMessage])

    // Close attachment menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement
            if (showAttachmentMenu && !target.closest('.relative')) {
                setShowAttachmentMenu(false)
            }
        }

        if (showAttachmentMenu) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showAttachmentMenu])


    const handleSend = async () => {
        if (!newMessage.trim() || !conversationId || !user || sending) return

        const messageToSend = newMessage.trim()
        // Clear input immediately for instant feedback
        setNewMessage('')
        setSending(true)

        try {
            await sendMessage(
                conversationId,
                user.uid,
                user.displayName || 'User',
                messageToSend
            )
        } catch (error) {
            console.error('Error sending message:', error)
            // Restore message on error
            setNewMessage(messageToSend)
        } finally {
            setSending(false)
        }
    }

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0 || !conversationId || !user) return

        // Limit to 10 files
        const limitedFiles = files.slice(0, 10)

        // Create media items for preview
        const mediaItems: MediaItem[] = limitedFiles.map(file => ({
            file,
            type: file.type.startsWith('image') ? 'image' : 'video',
            url: URL.createObjectURL(file)
        }))

        setSelectedMedia(mediaItems)
        setShowMediaPreview(true)

        // Reset file input
        e.target.value = ''
    }

    // Helper function to convert data URL to blob (more reliable than fetch on mobile)
    const dataURLtoBlob = (dataURL: string): Blob => {
        const parts = dataURL.split(',')
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
        const bstr = atob(parts[1])
        let n = bstr.length
        const u8arr = new Uint8Array(n)
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n)
        }
        return new Blob([u8arr], { type: mime })
    }

    const handleSendMedia = async (mediaItems: MediaItem[]) => {
        if (!conversationId || !user) return

        setUploading(true)
        setUploadProgress(0)
        setShowMediaPreview(false) // Close the preview modal

        try {
            for (let i = 0; i < mediaItems.length; i++) {
                const item = mediaItems[i]

                // Use annotated image if available, otherwise use original
                let fileToUpload = item.file
                if (item.annotations && item.type === 'image') {
                    try {
                        // Convert dataURL to blob using custom function (more reliable on mobile)
                        const blob = dataURLtoBlob(item.annotations)
                        const fileName = item.file.name
                        fileToUpload = new File([blob], fileName, { type: 'image/png' })
                        console.log('Converted annotated image:', {
                            originalSize: item.file.size,
                            newSize: blob.size,
                            fileName
                        })
                    } catch (conversionError) {
                        console.error('Error converting annotated image, using original:', conversionError)
                        // Fall back to original file if conversion fails
                        fileToUpload = item.file
                    }
                }

                const fileName = `${item.type}-${Date.now()}-${i}.${fileToUpload.name.split('.').pop()}`

                const mediaUrl = await uploadChatMedia(conversationId, fileToUpload, (progress) => {
                    setUploadProgress(((i + progress / 100) / mediaItems.length) * 100)
                })

                await sendMediaMessage(
                    conversationId,
                    user.uid,
                    user.displayName || 'User',
                    mediaUrl,
                    item.type,
                    fileName,
                    fileToUpload.size,
                    item.caption // Pass the caption
                )
                URL.revokeObjectURL(item.url) // Clean up object URL
            }
            setSelectedMedia([]) // Clear selected media after sending
        } catch (error) {
            console.error('Error sending media:', error)
            alert('Failed to send media. Please try again.')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream)
            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                const audioUrl = URL.createObjectURL(audioBlob)
                const duration = recordingDuration
                setRecordedAudio({ blob: audioBlob, url: audioUrl, duration })
                stream.getTracks().forEach(track => track.stop())

                // Clear timer
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current)
                    recordingTimerRef.current = null
                }
                setRecordingDuration(0)
            }

            mediaRecorder.start()
            setIsRecording(true)

            // Start timer
            recordingStartTimeRef.current = Date.now()
            recordingTimerRef.current = setInterval(() => {
                const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
                setRecordingDuration(elapsed)
            }, 100)
        } catch (error) {
            console.error('Error accessing microphone:', error)
            alert('Could not access microphone. Please check your permissions.')
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop()
            setIsRecording(false)
        }
    }

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Ctrl+Enter or Cmd+Enter to send
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault()
            handleSend()
        }
        // Enter alone creates new line (default behavior)
    }

    const handlePlayPreview = () => {
        if (audioPreviewRef.current && recordedAudio) {
            if (isPlayingPreview) {
                audioPreviewRef.current.pause()
                setIsPlayingPreview(false)
            } else {
                audioPreviewRef.current.play()
                setIsPlayingPreview(true)
            }
        }
    }

    const handlePreviewSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (audioPreviewRef.current) {
            const time = parseFloat(e.target.value)
            audioPreviewRef.current.currentTime = time
            setPreviewCurrentTime(time)
        }
    }

    const handleMessagePlay = (messageId: string, audioUrl: string) => {
        const audio = messageAudioRefs.current[messageId]
        if (!audio) {
            const newAudio = new Audio(audioUrl)
            messageAudioRefs.current[messageId] = newAudio

            newAudio.addEventListener('timeupdate', () => {
                setMessageCurrentTimes(prev => ({ ...prev, [messageId]: newAudio.currentTime }))
            })

            newAudio.addEventListener('ended', () => {
                setPlayingMessageId(null)
                setMessageCurrentTimes(prev => ({ ...prev, [messageId]: 0 }))
            })

            newAudio.play()
            setPlayingMessageId(messageId)
        } else {
            if (playingMessageId === messageId) {
                audio.pause()
                setPlayingMessageId(null)
            } else {
                // Pause other audios
                Object.entries(messageAudioRefs.current).forEach(([id, aud]) => {
                    if (id !== messageId) aud.pause()
                })
                audio.play()
                setPlayingMessageId(messageId)
            }
        }
    }

    const handleMessageSeek = (messageId: string, time: number) => {
        const audio = messageAudioRefs.current[messageId]
        if (audio) {
            audio.currentTime = time
            setMessageCurrentTimes(prev => ({ ...prev, [messageId]: time }))
        }
    }

    const handleSendVoiceMessage = async () => {
        if (!recordedAudio || !conversationId || !user) return

        setUploading(true)
        setUploadProgress(0)

        try {
            const fileName = `voice-message-${Date.now()}.webm`
            const file = new File([recordedAudio.blob], fileName, { type: 'audio/webm' })

            const mediaUrl = await uploadChatMedia(conversationId, file, (progress) => {
                setUploadProgress(progress)
            })

            await sendMediaMessage(
                conversationId,
                user.uid,
                user.displayName || 'User',
                mediaUrl,
                'audio',
                fileName,
                recordedAudio.blob.size
            )

            // Clean up
            URL.revokeObjectURL(recordedAudio.url)
            setRecordedAudio(null)
        } catch (error) {
            console.error('Error uploading audio:', error)
            alert('Failed to send voice message. Please try again.')
        } finally {
            setUploading(false)
            setUploadProgress(0)
        }
    }

    const handleCancelVoiceMessage = () => {
        if (recordedAudio) {
            URL.revokeObjectURL(recordedAudio.url)
            setRecordedAudio(null)
            setIsPlayingPreview(false)
        }
    }

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp)
        const now = new Date()
        const isToday = date.toDateString() === now.toDateString()

        if (isToday) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    if (!mounted) return null

    const modalContent = (
        <div
            className={fullPage
                ? 'fixed inset-0 z-[9999] flex flex-col'
                : 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-0 md:p-4'
            }
            style={fullPage ? { backgroundColor: isDark ? '#1c1c1c' : '#ffffff' } : undefined}
        >
            <div
                className={fullPage
                    ? 'flex flex-col flex-1 w-full overflow-hidden'
                    : 'w-full h-full md:max-w-2xl md:h-[600px] md:rounded-2xl overflow-hidden flex flex-col'
                }
                style={{
                    backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                    boxShadow: fullPage ? 'none' : isDark
                        ? '0 25px 50px -12px rgba(255, 255, 255, 0.2)'
                        : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
            >
                {/* Header */}
                <div
                    className="p-4 border-b flex items-center justify-between"
                    style={{
                        borderColor: isDark ? '#2a2a2a' : '#e5e7eb',
                        // On the /dashboard/chat page (fullPage mode), push header below Android status bar
                        paddingTop: fullPage ? 'calc(1rem + env(safe-area-inset-top))' : undefined,
                    }}
                >
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-bold truncate" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            {otherUserName}
                        </h2>
                        <p className="text-xs truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                            {jobTitle}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href={`tel:${otherUserPhone || otherUserEmail}`}
                            className="p-2 rounded-full bg-green-600 hover:bg-green-700 transition-colors"
                            title={otherUserPhone ? `Call ${otherUserPhone}` : "Phone number not available"}
                        >
                            <Phone className="w-5 h-5 text-white" />
                        </a>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div
                    className="flex-1 overflow-y-auto p-4 space-y-3"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        willChange: 'scroll-position'
                    }}
                >
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                                No messages yet. Start the conversation!
                            </p>
                        </div>
                    ) : (
                        messages.map((message) => {
                            const isOwn = message.senderId === user?.uid
                            return (
                                <div
                                    key={message.id}
                                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`${message.mediaType === 'audio' ? 'max-w-[90%] md:max-w-[80%]' : 'max-w-[75%] md:max-w-[60%]'} rounded-2xl overflow-hidden ${isOwn
                                            ? 'bg-blue-600 text-white rounded-br-sm'
                                            : isDark
                                                ? 'bg-gray-800 text-white rounded-bl-sm'
                                                : 'bg-gray-200 text-gray-900 rounded-bl-sm'
                                            }`}
                                    >
                                        {!isOwn && (
                                            <p className="text-xs font-semibold px-4 pt-2 opacity-70">
                                                {message.senderName}
                                            </p>
                                        )}

                                        {/* Media Content */}
                                        {message.mediaUrl && message.mediaType === 'image' && (
                                            <>
                                                <div
                                                    className="relative w-full cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => message.mediaUrl && setSelectedImage(message.mediaUrl)}
                                                >
                                                    <Image
                                                        src={message.mediaUrl}
                                                        alt={message.fileName || 'Image'}
                                                        width={300}
                                                        height={300}
                                                        className="w-full h-auto max-h-96 object-cover rounded-lg"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                {message.caption && (
                                                    <p className="text-sm px-4 py-2 break-words whitespace-pre-wrap">
                                                        {message.caption}
                                                    </p>
                                                )}
                                            </>
                                        )}

                                        {message.mediaUrl && message.mediaType === 'video' && (() => {
                                            // Extract publicId from Cloudinary URL for rotation correction
                                            const getPublicIdFromUrl = (url: string) => {
                                                // Handle both formats:
                                                // https://res.cloudinary.com/cloud/video/upload/v123/folder/file.mp4
                                                // https://res.cloudinary.com/cloud/video/upload/folder/file.mp4
                                                const match = url.match(/\/video\/upload\/(?:v\d+\/)?(.+)$/)
                                                if (match) {
                                                    // Remove file extension
                                                    return match[1].replace(/\.\w+$/, '')
                                                }
                                                return null
                                            }

                                            const isCloudinary = message.mediaUrl.includes('cloudinary')
                                            const publicId = isCloudinary ? getPublicIdFromUrl(message.mediaUrl) : null
                                            const videoSrc = isCloudinary && publicId
                                                ? getRotationCorrectedVideoUrl(publicId)
                                                : message.mediaUrl

                                            // Debug logging
                                            console.log('Video Debug:', {
                                                originalUrl: message.mediaUrl,
                                                isCloudinary,
                                                publicId,
                                                correctedUrl: videoSrc
                                            })

                                            return (
                                                <>
                                                    <div
                                                        className="relative cursor-pointer group"
                                                        onClick={() => setSelectedVideo(videoSrc)}
                                                    >
                                                        <video
                                                            src={videoSrc}
                                                            className="w-full max-h-64 rounded-lg"
                                                            preload="metadata"
                                                            playsInline
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors rounded-lg">
                                                            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-gray-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                                                                    <path d="M8 5v14l11-7z" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {message.caption && (
                                                        <p className="text-sm px-4 py-2 break-words whitespace-pre-wrap">
                                                            {message.caption}
                                                        </p>
                                                    )}
                                                </>
                                            )
                                        })()}

                                        {message.mediaUrl && message.mediaType === 'audio' && (
                                            <div className="px-3 py-2 w-full">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <button
                                                        onClick={() => handleMessagePlay(message.id, message.mediaUrl!)}
                                                        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0"
                                                    >
                                                        {playingMessageId === message.id ?
                                                            <Square className="w-3 h-3" /> :
                                                            <Play className="w-3 h-3" />
                                                        }
                                                    </button>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs" style={{ color: isOwn ? '#e0e0e0' : isDark ? '#9ca3af' : '#6b7280' }}>
                                                            {formatDuration(Math.floor(messageCurrentTimes[message.id] || 0))} / {message.fileName ? message.fileName.replace('voice-message-', '').replace('.webm', '') : '0:00'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max={messageAudioRefs.current[message.id]?.duration || 100}
                                                    value={messageCurrentTimes[message.id] || 0}
                                                    onChange={(e) => handleMessageSeek(message.id, parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                                    style={{
                                                        background: `linear-gradient(to right, ${isOwn ? '#60a5fa' : '#3b82f6'} 0%, ${isOwn ? '#60a5fa' : '#3b82f6'} ${((messageCurrentTimes[message.id] || 0) / (messageAudioRefs.current[message.id]?.duration || 100)) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} ${((messageCurrentTimes[message.id] || 0) / (messageAudioRefs.current[message.id]?.duration || 100)) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} 100%)`
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Text Content */}
                                        {message.text && (
                                            <p className="text-sm break-words whitespace-pre-wrap px-4 py-2">
                                                {message.text}
                                            </p>
                                        )}

                                        {/* Timestamp with Read Receipts */}
                                        <p
                                            className={`text-xs px-4 pb-2 flex items-center gap-1 ${isOwn ? 'text-blue-100 justify-end' : 'opacity-60'
                                                }`}
                                        >
                                            <span>
                                                {formatTime(message.timestamp)}
                                                {message.fileSize && ` • ${formatFileSize(message.fileSize)}`}
                                            </span>
                                            {isOwn && (
                                                <span className="flex items-center">
                                                    {message.read ? (
                                                        // Double check marks (blue) - Message read
                                                        <svg
                                                            viewBox="0 0 16 11"
                                                            width="16"
                                                            height="11"
                                                            className="text-blue-400"
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M11.071.653a.5.5 0 0 0-.707 0L5.5 5.518 3.636 3.654a.5.5 0 0 0-.707.707l2.218 2.218a.5.5 0 0 0 .707 0l5.218-5.218a.5.5 0 0 0 0-.708zm0 0"
                                                            />
                                                            <path
                                                                fill="currentColor"
                                                                d="M13.071.653a.5.5 0 0 0-.707 0L7.5 5.518 5.636 3.654a.5.5 0 0 0-.707.707l2.218 2.218a.5.5 0 0 0 .707 0l5.218-5.218a.5.5 0 0 0 0-.708zm0 0"
                                                            />
                                                        </svg>
                                                    ) : (
                                                        // Single check mark (gray) - Message sent/delivered
                                                        <svg
                                                            viewBox="0 0 16 11"
                                                            width="16"
                                                            height="11"
                                                            className="text-blue-100 opacity-60"
                                                        >
                                                            <path
                                                                fill="currentColor"
                                                                d="M11.071.653a.5.5 0 0 0-.707 0L5.5 5.518 3.636 3.654a.5.5 0 0 0-.707.707l2.218 2.218a.5.5 0 0 0 .707 0l5.218-5.218a.5.5 0 0 0 0-.708zm0 0"
                                                            />
                                                        </svg>
                                                    )}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Upload Progress */}
                {uploading && (
                    <div className="px-4 py-2 border-t" style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}>
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                            <div className="flex-1">
                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 transition-all"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                {Math.round(uploadProgress)}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Voice Message Preview */}
                {recordedAudio && (
                    <div
                        className="px-4 py-3 border-t"
                        style={{
                            borderColor: isDark ? '#2a2a2a' : '#e5e7eb',
                            backgroundColor: isDark ? '#1a1a1a' : '#f9fafb'
                        }}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={handlePlayPreview}
                                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0"
                                title={isPlayingPreview ? "Pause" : "Play preview"}
                            >
                                {isPlayingPreview ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    Voice Message
                                </p>
                                <p className="text-xs" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                    {formatDuration(Math.floor(previewCurrentTime))} / {formatDuration(recordedAudio.duration)}
                                </p>
                            </div>
                            <button
                                onClick={handleSendVoiceMessage}
                                disabled={uploading}
                                className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-full transition-colors flex-shrink-0"
                                title="Send"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleCancelVoiceMessage}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors flex-shrink-0"
                                title="Cancel"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Seekbar */}
                        <input
                            type="range"
                            min="0"
                            max={recordedAudio.duration}
                            value={previewCurrentTime}
                            onChange={handlePreviewSeek}
                            className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(previewCurrentTime / recordedAudio.duration) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} ${(previewCurrentTime / recordedAudio.duration) * 100}%, ${isDark ? '#4b5563' : '#d1d5db'} 100%)`
                            }}
                        />

                        <audio
                            ref={audioPreviewRef}
                            src={recordedAudio.url}
                            onTimeUpdate={() => setPreviewCurrentTime(audioPreviewRef.current?.currentTime || 0)}
                            onEnded={() => {
                                setIsPlayingPreview(false)
                                setPreviewCurrentTime(0)
                            }}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Input */}
                <div
                    className="p-4 border-t"
                    style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}
                >
                    <div className="flex gap-2 items-end">
                        {/* Gallery input - no capture attribute */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {/* Camera input - with capture attribute */}
                        <input
                            id="camera-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        {/* Video input - with capture attribute */}
                        <input
                            id="video-input"
                            type="file"
                            accept="video/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="relative">
                            <button
                                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                                disabled={uploading || isRecording || recordedAudio !== null}
                                className="p-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors flex-shrink-0"
                                title="Attach media"
                            >
                                <Paperclip className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                            </button>
                            {showAttachmentMenu && (
                                <div
                                    className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
                                    style={{ minWidth: '160px' }}
                                >
                                    <button
                                        onClick={() => {
                                            document.getElementById('camera-input')?.click()
                                            setShowAttachmentMenu(false)
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                    >
                                        <Camera className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                                        <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Camera</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            fileInputRef.current?.click()
                                            setShowAttachmentMenu(false)
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                    >
                                        <ImageIcon className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                                        <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Gallery</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            document.getElementById('video-input')?.click()
                                            setShowAttachmentMenu(false)
                                        }}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                    >
                                        <Video className="w-5 h-5" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                                        <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>Video</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            rows={1}
                            className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none max-h-[120px] overflow-y-auto"
                            disabled={sending || uploading || isRecording || recordedAudio !== null}
                            style={{ minHeight: '44px' }}
                        />
                        {newMessage.trim() ? (
                            <button
                                onClick={handleSend}
                                disabled={sending || uploading}
                                className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full transition-colors flex-shrink-0"
                                title="Send message"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        ) : recordedAudio === null && (
                            <button
                                onClick={isRecording ? stopRecording : startRecording}
                                disabled={uploading}
                                className={`p-2.5 ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full transition-colors flex-shrink-0`}
                                title={isRecording ? "Stop recording" : "Record voice message"}
                            >
                                {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        )}
                    </div>
                    {!newMessage.trim() && !isRecording && !recordedAudio && (
                        <p className="text-xs mt-2 text-center" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                            Click the microphone to record a voice message
                        </p>
                    )}
                    {isRecording && (
                        <div className="mt-2">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <div className="flex gap-0.5 h-6 items-center flex-1 max-w-[200px]">
                                    {[...Array(15)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-red-600 rounded-full animate-pulse"
                                            style={{
                                                height: `${(i % 3 === 0 ? 24 : i % 3 === 1 ? 16 : 12)}px`,
                                                animationDelay: `${i * 100}ms`,
                                                minWidth: '2px'
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-center text-red-600 dark:text-red-400 font-medium">
                                🔴 {formatDuration(recordingDuration)}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Viewer Modal */}
            {selectedImage && (
                <ImageViewerModal
                    media={[{ type: 'image', url: selectedImage }]}
                    initialIndex={0}
                    onClose={() => setSelectedImage(null)}
                />
            )}

            {/* Media Preview Modal */}
            {showMediaPreview && selectedMedia.length > 0 && (
                <MediaPreviewModal
                    media={selectedMedia}
                    onClose={() => {
                        setShowMediaPreview(false)
                        setSelectedMedia([])
                    }}
                    onSend={handleSendMedia}
                />
            )}

            {/* Video Viewer Modal */}
            {selectedVideo && (
                <VideoViewerModal
                    videoUrl={selectedVideo}
                    onClose={() => setSelectedVideo(null)}
                />
            )}
        </div>
    )

    if (fullPage) {
        // Render as a dedicated overlay — modalContent already handles fullPage styles
        return createPortal(modalContent, document.body)
    }

    return createPortal(modalContent, document.body)
}
