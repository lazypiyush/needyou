'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Trash2, Edit3, ChevronLeft, ChevronRight, Undo } from 'lucide-react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

export interface MediaItem {
    file: File
    type: 'image' | 'video'
    url: string
    caption?: string
    annotations?: string // base64 canvas data
}

interface MediaPreviewModalProps {
    media: MediaItem[]
    onClose: () => void
    onSend: (items: MediaItem[]) => Promise<void>
}

export default function MediaPreviewModal({ media: initialMedia, onClose, onSend }: MediaPreviewModalProps) {
    const { theme, systemTheme } = useTheme()
    const [media, setMedia] = useState<MediaItem[]>(initialMedia)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawingMode, setDrawingMode] = useState(false)
    const [selectedColor, setSelectedColor] = useState('#FF0000')
    const [mounted, setMounted] = useState(false)
    const [sending, setSending] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const imageRef = useRef<HTMLImageElement>(null)
    const [isMouseDown, setIsMouseDown] = useState(false)
    const [lastPos, setLastPos] = useState<{ x: number; y: number } | null>(null)
    const [drawingHistory, setDrawingHistory] = useState<string[]>([])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const colors = [
        '#FFFFFF', // White
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFF00', // Yellow
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFA500', // Orange
        '#800080', // Purple
        '#000000', // Black
    ]

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (drawingMode && canvasRef.current && imageRef.current) {
            const canvas = canvasRef.current
            const img = imageRef.current
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight

            // Restore previous annotations if any
            if (media[currentIndex].annotations) {
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    const image = new window.Image()
                    image.onload = () => {
                        ctx.drawImage(image, 0, 0)
                    }
                    image.src = media[currentIndex].annotations!
                }
            }
        }
    }, [drawingMode, currentIndex, media])

    const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return null

        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height

        let clientX, clientY
        if ('touches' in e) {
            clientX = e.touches[0].clientX
            clientY = e.touches[0].clientY
        } else {
            clientX = e.clientX
            clientY = e.clientY
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        }
    }

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (!drawingMode) return
        e.preventDefault()

        const coords = getCanvasCoordinates(e)
        if (coords) {
            setIsMouseDown(true)
            setLastPos(coords)

            // Save current state for undo
            const canvas = canvasRef.current
            if (canvas) {
                setDrawingHistory([...drawingHistory, canvas.toDataURL()])
            }
        }
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isMouseDown || !drawingMode || !lastPos) return
        e.preventDefault()

        const coords = getCanvasCoordinates(e)
        if (!coords) return

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx) return

        ctx.strokeStyle = selectedColor
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        ctx.beginPath()
        ctx.moveTo(lastPos.x, lastPos.y)
        ctx.lineTo(coords.x, coords.y)
        ctx.stroke()

        setLastPos(coords)
    }

    const stopDrawing = () => {
        setIsMouseDown(false)
        setLastPos(null)

        // Save annotations
        if (canvasRef.current && drawingMode) {
            const updatedMedia = [...media]
            updatedMedia[currentIndex].annotations = canvasRef.current.toDataURL()
            setMedia(updatedMedia)
        }
    }

    const handleUndo = () => {
        if (drawingHistory.length === 0) return

        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        const lastState = drawingHistory[drawingHistory.length - 1]
        setDrawingHistory(drawingHistory.slice(0, -1))

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (lastState) {
            const img = new window.Image()
            img.onload = () => {
                ctx.drawImage(img, 0, 0)
            }
            img.src = lastState
        }
    }

    const handleDelete = () => {
        const updatedMedia = media.filter((_, index) => index !== currentIndex)
        setMedia(updatedMedia)

        if (updatedMedia.length === 0) {
            onClose()
        } else if (currentIndex >= updatedMedia.length) {
            setCurrentIndex(updatedMedia.length - 1)
        }
    }

    const handleSend = async () => {
        setSending(true)
        try {
            await onSend(media)
            onClose()
        } catch (error) {
            console.error('Error sending media:', error)
        } finally {
            setSending(false)
        }
    }

    const goToPrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1)
            setDrawingMode(false)
        }
    }

    const goToNext = () => {
        if (currentIndex < media.length - 1) {
            setCurrentIndex(currentIndex + 1)
            setDrawingMode(false)
        }
    }

    if (!mounted || media.length === 0) return null

    const currentMedia = media[currentIndex]

    const modalContent = (
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col">
            {/* Header */}
            <div className="p-4 flex items-center justify-between bg-black/50">
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-6 h-6 text-white" />
                </button>
                <span className="text-white font-medium">
                    {currentIndex + 1} / {media.length}
                </span>
                <button
                    onClick={handleDelete}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <Trash2 className="w-6 h-6 text-white" />
                </button>
            </div>

            {/* Media Display */}
            <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                {currentMedia.type === 'image' ? (
                    <div className="relative max-w-full max-h-full">
                        <img
                            ref={imageRef}
                            src={currentMedia.url}
                            alt="Preview"
                            className="max-w-full max-h-[70vh] object-contain"
                        />
                        {drawingMode && (
                            <canvas
                                ref={canvasRef}
                                className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                                style={{ touchAction: 'none' }}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            />
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <video
                            src={currentMedia.url}
                            controls
                            disablePictureInPicture
                            playsInline
                            preload="metadata"
                            className="w-full h-full"
                            style={{
                                maxHeight: '80vh',
                                maxWidth: '100%',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                )}

                {/* Navigation Arrows */}
                {media.length > 1 && (
                    <>
                        {currentIndex > 0 && (
                            <button
                                onClick={goToPrevious}
                                className="absolute left-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                            >
                                <ChevronLeft className="w-6 h-6 text-white" />
                            </button>
                        )}
                        {currentIndex < media.length - 1 && (
                            <button
                                onClick={goToNext}
                                className="absolute right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors"
                            >
                                <ChevronRight className="w-6 h-6 text-white" />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Drawing Tools */}
            {drawingMode && currentMedia.type === 'image' && (
                <div className="p-4 bg-black/50 flex items-center justify-center gap-4">
                    <div className="flex gap-2 overflow-x-auto">
                        {colors.map((color) => (
                            <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={`w-10 h-10 rounded-full border-2 ${selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                                    }`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                    <button
                        onClick={handleUndo}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                        <Undo className="w-5 h-5 text-white" />
                    </button>
                </div>
            )}

            {/* Bottom Bar */}
            <div className="p-4 bg-black/50 flex items-center gap-3">
                {currentMedia.type === 'image' && !drawingMode && (
                    <button
                        onClick={() => setDrawingMode(true)}
                        className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    >
                        <Edit3 className="w-5 h-5 text-white" />
                    </button>
                )}
                {drawingMode && (
                    <button
                        onClick={() => setDrawingMode(false)}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white text-sm transition-colors"
                    >
                        Done
                    </button>
                )}
                <input
                    type="text"
                    placeholder="Add a caption..."
                    value={currentMedia.caption || ''}
                    onChange={(e) => {
                        const updatedMedia = [...media]
                        updatedMedia[currentIndex].caption = e.target.value
                        setMedia(updatedMedia)
                    }}
                    className="flex-1 px-4 py-2 bg-white/10 text-white placeholder-white/50 rounded-full outline-none focus:bg-white/20"
                />
                <button
                    onClick={handleSend}
                    disabled={sending}
                    className="p-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-full transition-colors"
                >
                    <Send className="w-5 h-5 text-white" />
                </button>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
