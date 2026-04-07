'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, ChevronRight, Smartphone } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
export type UpiApp = {
    id: string
    name: string
    logo: string
    packageName: string   // Android package name (for Razorpay intent)
    color: string
}

export type UpiSelection =
    | { type: 'app'; app: UpiApp }
    | { type: 'id'; upiId: string }
    | { type: 'qr' }

interface UpiPaymentSheetProps {
    amount: number
    jobTitle: string
    isDark: boolean
    onSelect: (selection: UpiSelection) => Promise<void>
    onClose: () => void
}

// ── UPI App definitions ─────────────────────────────────────────────────────
const UPI_APPS: UpiApp[] = [
    {
        id: 'gpay',
        name: 'Google Pay',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/512px-Google_Pay_Logo.svg.png',
        packageName: 'com.google.android.apps.nbu.paisa.user',
        color: '#4285F4',
    },
    {
        id: 'phonepe',
        name: 'PhonePe',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/71/PhonePe_Logo.svg/512px-PhonePe_Logo.svg.png',
        packageName: 'com.phonepe.app',
        color: '#5F259F',
    },
    {
        id: 'paytm',
        name: 'Paytm',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/2560px-Paytm_Logo_%28standalone%29.svg.png',
        packageName: 'net.one97.paytm',
        color: '#00BAF2',
    },
    {
        id: 'bhim',
        name: 'BHIM',
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/c/cb/BHIM_logo.svg/512px-BHIM_logo.svg.png',
        packageName: 'in.org.npci.upiapp',
        color: '#00529A',
    },
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function UpiPaymentSheet({
    amount,
    jobTitle,
    isDark,
    onSelect,
    onClose,
}: UpiPaymentSheetProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [showUpiInput, setShowUpiInput] = useState(false)
    const [upiIdInput, setUpiIdInput] = useState('')
    const [upiError, setUpiError] = useState('')

    const bg = isDark ? '#141414' : '#fafafa'
    const cardBg = isDark ? '#1e1e1e' : '#ffffff'
    const border = isDark ? '#2a2a2a' : '#e5e7eb'
    const textPri = isDark ? '#ffffff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'

    const handleAppClick = async (app: UpiApp) => {
        setLoadingId(app.id)
        try {
            await onSelect({ type: 'app', app })
        } finally {
            setLoadingId(null)
        }
    }

    const handleUpiIdSubmit = async () => {
        const trimmed = upiIdInput.trim()
        if (!trimmed) { setUpiError('Please enter your UPI ID'); return }
        if (!/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(trimmed)) {
            setUpiError('Invalid UPI ID. Example: name@upi')
            return
        }
        setUpiError('')
        setLoadingId('upi-id')
        try {
            await onSelect({ type: 'id', upiId: trimmed })
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <div
            className="fixed inset-0 z-[999999] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                className="w-full max-w-sm rounded-t-3xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: bg, border: `1px solid ${border}`, borderBottom: 'none' }}
            >
                {/* Handle bar */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ backgroundColor: border }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-2 pb-3">
                    <div>
                        <p className="text-base font-bold" style={{ color: textPri }}>Pay with UPI</p>
                        <p className="text-xs mt-0.5" style={{ color: textSec }}>
                            ₹{amount.toLocaleString('en-IN')} · {jobTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full transition-colors"
                        style={{ background: isDark ? '#2a2a2a' : '#f3f4f6' }}
                    >
                        <X className="w-4 h-4" style={{ color: textSec }} />
                    </button>
                </div>

                <div className="px-5 pb-8" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>
                    {/* UPI App Buttons */}
                    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: textSec }}>
                        Pay via App
                    </p>

                    <div className="grid grid-cols-4 gap-3 mb-5">
                        {UPI_APPS.map(app => (
                            <button
                                key={app.id}
                                onClick={() => handleAppClick(app)}
                                disabled={loadingId !== null}
                                className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl border transition-all active:scale-95 disabled:opacity-60"
                                style={{
                                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                                    borderColor: border,
                                    boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                            >
                                {loadingId === app.id ? (
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: app.color }} />
                                ) : (
                                    <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
                                        style={{ background: `${app.color}15` }}>
                                        <img
                                            src={app.logo}
                                            alt={app.name}
                                            className="w-7 h-7 object-contain"
                                            onError={e => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    </div>
                                )}
                                <span className="text-[10px] font-semibold text-center leading-tight"
                                    style={{ color: textPri }}>
                                    {app.name.split(' ')[0]}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px" style={{ background: border }} />
                        <span className="text-xs font-medium" style={{ color: textSec }}>or</span>
                        <div className="flex-1 h-px" style={{ background: border }} />
                    </div>

                    {/* UPI ID Input */}
                    <AnimatePresence mode="wait">
                        {!showUpiInput ? (
                            <motion.button
                                key="show-btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowUpiInput(true)}
                                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98]"
                                style={{
                                    backgroundColor: cardBg,
                                    borderColor: border,
                                    boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: isDark ? '#2a2a2a' : '#f3f4f6' }}>
                                        <Smartphone className="w-4 h-4" style={{ color: '#6366f1' }} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-semibold" style={{ color: textPri }}>Enter UPI ID</p>
                                        <p className="text-xs" style={{ color: textSec }}>Pay via any UPI app</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4" style={{ color: textSec }} />
                            </motion.button>
                        ) : (
                            <motion.div
                                key="upi-form"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                            >
                                <div>
                                    <label className="text-xs font-semibold mb-1.5 block"
                                        style={{ color: textSec }}>
                                        UPI ID
                                    </label>
                                    <input
                                        type="text"
                                        value={upiIdInput}
                                        onChange={e => { setUpiIdInput(e.target.value); setUpiError('') }}
                                        placeholder="yourname@upi"
                                        autoFocus
                                        className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        style={{
                                            backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                            borderColor: upiError ? '#ef4444' : border,
                                            color: textPri,
                                            fontSize: 16,
                                        }}
                                        onKeyDown={e => { if (e.key === 'Enter') handleUpiIdSubmit() }}
                                    />
                                    {upiError && (
                                        <p className="text-xs text-red-500 mt-1">{upiError}</p>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => { setShowUpiInput(false); setUpiIdInput(''); setUpiError('') }}
                                        className="py-3 rounded-xl text-sm font-semibold border transition-all"
                                        style={{ borderColor: border, color: textSec, backgroundColor: 'transparent' }}
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleUpiIdSubmit}
                                        disabled={loadingId === 'upi-id'}
                                        className="py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                                        style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                    >
                                        {loadingId === 'upi-id'
                                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                                            : 'Pay Now'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Security note */}
                    <p className="text-center text-[10px] mt-4" style={{ color: isDark ? '#404040' : '#d1d5db' }}>
                        🔒 Secured by Razorpay · Payments are encrypted
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
