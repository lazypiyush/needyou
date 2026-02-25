'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { useModalHistory } from '@/hooks/useModalHistory'

interface ImageViewerModalProps {
    media: Array<{
        type: 'image' | 'video'
        url: string
    }>
    initialIndex?: number
    onClose: () => void
}

export default function ImageViewerModal({ media, initialIndex = 0, onClose }: ImageViewerModalProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)
    const [mounted, setMounted] = useState(false)
    const [zoom, setZoom] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const imageContainerRef = useRef<HTMLDivElement>(null)
    const lastTouchDistance = useRef<number>(0)
    const swipeStartX = useRef<number | null>(null) // for single-finger image navigation
    const { theme, systemTheme } = useTheme()
    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Back button closes image viewer
    useModalHistory(true, onClose)

    const MIN_ZOOM = 0.5
    const MAX_ZOOM = 5
    const ZOOM_STEP = 0.25

    useEffect(() => {
        setMounted(true)

        // Prevent default touch behaviors on the entire document when modal is open
        const preventDefaultTouch = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault()
            }
        }

        document.addEventListener('touchmove', preventDefaultTouch, { passive: false })
        document.addEventListener('gesturestart', (e) => e.preventDefault())
        document.addEventListener('gesturechange', (e) => e.preventDefault())
        document.addEventListener('gestureend', (e) => e.preventDefault())

        return () => {
            document.removeEventListener('touchmove', preventDefaultTouch)
        }
    }, [])

    // Reset zoom and position when changing media
    useEffect(() => {
        setZoom(1)
        setPosition({ x: 0, y: 0 })
    }, [currentIndex])

    const goToPrevious = () => {
        setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1))
    }

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM))
    }

    const handleZoomOut = () => {
        setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM))
    }

    const handleResetZoom = () => {
        setZoom(1)
        setPosition({ x: 0, y: 0 })
    }

    // Keyboard navigation and zoom shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Navigation
            if (e.key === 'ArrowLeft' && !e.ctrlKey) goToPrevious()
            if (e.key === 'ArrowRight' && !e.ctrlKey) goToNext()
            if (e.key === 'Escape') onClose()

            // Zoom shortcuts
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '+' || e.key === '=') {
                    e.preventDefault()
                    handleZoomIn()
                }
                if (e.key === '-' || e.key === '_') {
                    e.preventDefault()
                    handleZoomOut()
                }
                if (e.key === '0') {
                    e.preventDefault()
                    handleResetZoom()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [currentIndex])

    // Mouse wheel zoom (with Ctrl key) and touchpad pinch-to-zoom
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            // Touchpad pinch-to-zoom and Ctrl+scroll both set ctrlKey
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
                // Use deltaY for zoom - negative = zoom in, positive = zoom out
                const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
                setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)))
            }
        }

        // Add to window to capture all wheel events
        window.addEventListener('wheel', handleWheel, { passive: false })
        return () => window.removeEventListener('wheel', handleWheel)
    }, [])


    // Pan/drag support when zoomed in
    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            e.preventDefault()
            setIsDragging(true)
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoom > 1) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    // Unified touch support - handles both pinch (2 fingers) and drag (1 finger)
    const getDistance = (touches: React.TouchList) => {
        const dx = touches[0].clientX - touches[1].clientX
        const dy = touches[0].clientY - touches[1].clientY
        return Math.sqrt(dx * dx + dy * dy)
    }

    const handleTouchStartUnified = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Two fingers - pinch to zoom
            e.preventDefault()
            e.stopPropagation()
            lastTouchDistance.current = getDistance(e.touches)
            setIsDragging(false)
        } else if (e.touches.length === 1) {
            if (zoom > 1) {
                // Zoomed in - drag to pan
                e.preventDefault()
                setIsDragging(true)
                setDragStart({
                    x: e.touches[0].clientX - position.x,
                    y: e.touches[0].clientY - position.y,
                })
            } else {
                // Normal zoom - store start for swipe navigation
                swipeStartX.current = e.touches[0].clientX
            }
        }
    }

    const handleTouchMoveUnified = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // Two fingers - pinch to zoom
            e.preventDefault()
            e.stopPropagation()

            const currentDistance = getDistance(e.touches)
            const distanceDiff = currentDistance - lastTouchDistance.current

            // Smooth zoom with functional update
            const zoomDelta = distanceDiff * 0.01
            setZoom((prevZoom) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom + zoomDelta)))

            lastTouchDistance.current = currentDistance
            setIsDragging(false) // Ensure dragging is off during pinch
        } else if (e.touches.length === 1 && isDragging && zoom > 1) {
            // Single finger when zoomed - drag to pan
            e.preventDefault()
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            })
        }
    }

    const handleTouchEndUnified = (e: React.TouchEvent) => {
        setIsDragging(false)
        lastTouchDistance.current = 0
        // Single-finger swipe at zoom=1 → navigate between images
        if (swipeStartX.current !== null && zoom === 1 && media.length > 1) {
            const diff = swipeStartX.current - e.changedTouches[0].clientX
            if (Math.abs(diff) > 60) {
                if (diff > 0) goToNext()
                else goToPrevious()
            }
            swipeStartX.current = null
        }
    }

    if (!mounted) return null

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
            onClick={handleBackdropClick}
            onTouchStart={e => e.stopPropagation()}
            onTouchEnd={e => e.stopPropagation()}
            style={{ touchAction: 'none' }}
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                <button
                    onClick={handleZoomIn}
                    disabled={zoom >= MAX_ZOOM}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom In (Ctrl +)"
                >
                    <ZoomIn className="w-6 h-6 text-white" />
                </button>
                <button
                    onClick={handleZoomOut}
                    disabled={zoom <= MIN_ZOOM}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Zoom Out (Ctrl -)"
                >
                    <ZoomOut className="w-6 h-6 text-white" />
                </button>
                <button
                    onClick={handleResetZoom}
                    disabled={zoom === 1 && position.x === 0 && position.y === 0}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Reset Zoom (Ctrl 0)"
                >
                    <Maximize2 className="w-6 h-6 text-white" />
                </button>
                <div className="text-white text-xs text-center bg-black/50 px-2 py-1 rounded-full">
                    {Math.round(zoom * 100)}%
                </div>
            </div>

            {/* Navigation Buttons */}
            {media.length > 1 && (
                <>
                    <button
                        onClick={goToPrevious}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                    >
                        <ChevronLeft className="w-6 h-6 text-white" />
                    </button>
                    <button
                        onClick={goToNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
                    >
                        <ChevronRight className="w-6 h-6 text-white" />
                    </button>
                </>
            )}

            {/* Media Display */}
            <div
                ref={imageContainerRef}
                className="w-full h-full flex items-center justify-center overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStartUnified}
                onTouchMove={handleTouchMoveUnified}
                onTouchEnd={handleTouchEndUnified}
                style={{ touchAction: 'none' }}
            >
                {media[currentIndex].type === 'image' ? (
                    <div
                        className="relative flex items-center justify-center will-change-transform"
                        style={{
                            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                            cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            width: '100%',
                            height: '100%',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        }}
                    >
                        <Image
                            src={media[currentIndex].url}
                            alt={`Media ${currentIndex + 1}`}
                            width={1920}
                            height={1080}
                            className="w-full h-full object-contain select-none"
                            draggable={false}
                            style={{
                                maxWidth: '100vw',
                                maxHeight: '100vh',
                                pointerEvents: 'none',
                            }}
                        />
                    </div>
                ) : (
                    <video
                        src={media[currentIndex].url}
                        controls
                        autoPlay
                        className="max-w-full max-h-full object-contain"
                    />
                )}
            </div>

            {/* Counter */}
            {media.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                    {currentIndex + 1} / {media.length}
                </div>
            )}

            {/* Instructions */}
            <div className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg text-xs max-w-xs hidden md:block">
                <div className="font-semibold mb-1">Zoom Controls:</div>
                <div>• Ctrl + / Ctrl - : Zoom in/out</div>
                <div>• Ctrl + Scroll : Zoom</div>
                <div>• Pinch : Zoom on touch</div>
                <div>• Drag : Pan when zoomed</div>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
