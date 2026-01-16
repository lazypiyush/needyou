'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from 'next-themes'

interface VideoViewerModalProps {
    videoUrl: string
    onClose: () => void
}

export default function VideoViewerModal({ videoUrl, onClose }: VideoViewerModalProps) {
    const { theme, systemTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    if (!mounted) return null

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {/* Video Container */}
            <div
                className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                <video
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="max-w-full max-h-[90vh] w-auto h-auto"
                    style={{
                        objectFit: 'contain'
                    }}
                />
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
