'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, ChevronRight, Smartphone, AlertCircle, RefreshCw } from 'lucide-react'

// ── UXWing SVG logo URLs ────────────────────────────────────────────────────────
// Free for commercial use, no attribution required — uxwing.com/license/
const UXWING = 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media'

export type UpiApp = {
    id: string
    name: string
    logo: string         // URL from UXWing
    packageName: string  // Android package name passed to Razorpay intent
    color: string        // brand accent colour (used for icon bg tint)
}

export type UpiSelection =
    | { type: 'app'; app: UpiApp }
    | { type: 'id'; upiId: string }

// ── UPI App definitions (UXWing logos) ─────────────────────────────────────────
export const UPI_APPS: UpiApp[] = [
    {
        id: 'gpay',
        name: 'Google Pay',
        logo: `${UXWING}/google-pay-icon.svg`,
        packageName: 'com.google.android.apps.nbu.paisa.user',
        color: '#4285F4',
    },
    {
        id: 'phonepe',
        name: 'PhonePe',
        logo: `${UXWING}/phonepe-icon.svg`,
        packageName: 'com.phonepe.app',
        color: '#5F259F',
    },
    {
        id: 'paytm',
        name: 'Paytm',
        logo: `${UXWING}/paytm-icon.svg`,
        packageName: 'net.one97.paytm',
        color: '#00BAF2',
    },
    {
        id: 'bhim',
        name: 'BHIM UPI',
        logo: `${UXWING}/bhim-upi-icon.svg`,
        packageName: 'in.org.npci.upiapp',
        color: '#00529A',
    },
]

// ── Props ───────────────────────────────────────────────────────────────────────
interface UpiPaymentSheetProps {
    amount: number
    jobTitle: string
    isDark: boolean
    /** Called when user confirms their payment choice */
    onSelect: (selection: UpiSelection) => Promise<void>
    /** Called when user deliberately closes the sheet */
    onClose: () => void
    /**
     * If set, shows a dismissal hint at the top of the sheet
     * (used when Razorpay was dismissed — possibly app not installed).
     */
    dismissHint?: string | null
}

// ── Component ───────────────────────────────────────────────────────────────────
export default function UpiPaymentSheet({
    amount,
    jobTitle,
    isDark,
    onSelect,
    onClose,
    dismissHint,
}: UpiPaymentSheetProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [showUpiInput, setShowUpiInput] = useState(false)
    const [upiIdInput, setUpiIdInput] = useState('')
    const [upiError, setUpiError] = useState('')
    const [sheetError, setSheetError] = useState<string | null>(null)

    // ── Theme tokens ─────────────────────────────────────────────────────────────
    const bg       = isDark ? '#141414' : '#fafafa'
    const cardBg   = isDark ? '#1e1e1e' : '#ffffff'
    const border   = isDark ? '#2a2a2a' : '#e5e7eb'
    const textPri  = isDark ? '#ffffff' : '#111827'
    const textSec  = isDark ? '#9ca3af' : '#6b7280'
    const errorBg  = isDark ? '#2d0000' : '#fff5f5'
    const errorBdr = isDark ? '#7f1d1d' : '#fca5a5'

    // ── Handlers ─────────────────────────────────────────────────────────────────
    const handleAppClick = async (app: UpiApp) => {
        setSheetError(null)
        setLoadingId(app.id)
        try {
            await onSelect({ type: 'app', app })
        } catch (err: any) {
            // onSelect rejected — surface the error inline so user can retry
            setSheetError(err?.message || 'Something went wrong. Please try another option.')
        } finally {
            setLoadingId(null)
        }
    }

    const handleUpiIdSubmit = async () => {
        const trimmed = upiIdInput.trim()
        if (!trimmed) { setUpiError('Please enter your UPI ID'); return }
        // Standard UPI ID format: localpart@handle (e.g. 9876543210@upi, name@okaxis)
        if (!/^[a-zA-Z0-9._+-]+@[a-zA-Z]{3,}$/.test(trimmed)) {
            setUpiError('Invalid UPI ID. Example: 9876543210@upi or name@okaxis')
            return
        }
        setUpiError('')
        setSheetError(null)
        setLoadingId('upi-id')
        try {
            await onSelect({ type: 'id', upiId: trimmed })
        } catch (err: any) {
            setSheetError(err?.message || 'Payment could not be initiated. Please try again.')
        } finally {
            setLoadingId(null)
        }
    }

    const isLoading = loadingId !== null

    // ── Render ───────────────────────────────────────────────────────────────────
    return (
        <div
            className="fixed inset-0 z-[999999] flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget && !isLoading) onClose() }}
        >
            <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                className="w-full max-w-sm rounded-t-3xl overflow-hidden shadow-2xl"
                style={{ backgroundColor: bg, border: `1px solid ${border}`, borderBottom: 'none' }}
            >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ backgroundColor: border }} />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-2 pb-3">
                    <div>
                        <p className="text-base font-bold" style={{ color: textPri }}>Pay with UPI</p>
                        <p className="text-xs mt-0.5" style={{ color: textSec }}>
                            ₹{amount.toLocaleString('en-IN')}
                            {jobTitle ? ` · ${jobTitle.length > 28 ? jobTitle.slice(0, 28) + '…' : jobTitle}` : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-2 rounded-full transition-colors disabled:opacity-40"
                        style={{ background: isDark ? '#2a2a2a' : '#f3f4f6' }}
                        aria-label="Close payment sheet"
                    >
                        <X className="w-4 h-4" style={{ color: textSec }} />
                    </button>
                </div>

                <div className="px-5 pb-8" style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>

                    {/* ── Dismissal hint (app not installed or Razorpay cancelled) ── */}
                    {dismissHint && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
                            style={{ background: isDark ? '#1a1200' : '#fffbeb', border: `1px solid ${isDark ? '#713f12' : '#fde68a'}` }}
                        >
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">{dismissHint}</p>
                                <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80 mt-0.5">
                                    Make sure the app is installed, or try another option below.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* ── Generic sheet error (order creation / script load fail) ── */}
                    {sheetError && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-2 px-3 py-2.5 rounded-xl mb-4"
                            style={{ background: errorBg, border: `1px solid ${errorBdr}` }}
                        >
                            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs font-semibold text-red-600 dark:text-red-400">{sheetError}</p>
                                <button
                                    onClick={() => setSheetError(null)}
                                    className="text-[11px] text-red-500 font-medium flex items-center gap-1 mt-1"
                                >
                                    <RefreshCw className="w-3 h-3" /> Dismiss &amp; retry
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ── UPI App Buttons ─────────────────────────────────────── */}
                    <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: textSec }}>
                        Tap to open app
                    </p>

                    <div className="grid grid-cols-4 gap-2.5 mb-5">
                        {UPI_APPS.map(app => (
                            <button
                                key={app.id}
                                id={`upi-app-${app.id}`}
                                onClick={() => handleAppClick(app)}
                                disabled={isLoading}
                                className="flex flex-col items-center gap-2 py-3 px-1 rounded-2xl border transition-all active:scale-95 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                style={{
                                    backgroundColor: cardBg,
                                    borderColor: border,
                                    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.07)',
                                }}
                                aria-label={`Pay with ${app.name}`}
                            >
                                {loadingId === app.id ? (
                                    <div className="w-10 h-10 flex items-center justify-center rounded-xl"
                                        style={{ background: `${app.color}18` }}>
                                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: app.color }} />
                                    </div>
                                ) : (
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden"
                                        style={{ background: `${app.color}18` }}
                                    >
                                        <img
                                            src={app.logo}
                                            alt={app.name}
                                            width={28}
                                            height={28}
                                            className="w-7 h-7 object-contain"
                                            // If image fails to load (e.g. CORS/offline) show coloured fallback letter
                                            onError={e => {
                                                const img = e.target as HTMLImageElement
                                                img.style.display = 'none'
                                                const fb = img.nextElementSibling as HTMLElement | null
                                                if (fb) fb.style.display = 'flex'
                                            }}
                                        />
                                        {/* Fallback visible only when img fails */}
                                        <span
                                            className="hidden w-7 h-7 items-center justify-center text-sm font-black rounded-lg"
                                            style={{ display: 'none', color: app.color }}
                                        >
                                            {app.name[0]}
                                        </span>
                                    </div>
                                )}
                                <span
                                    className="text-[10px] font-semibold text-center leading-tight"
                                    style={{ color: textPri }}
                                >
                                    {/* Shorten "Google Pay" → "GPay" etc. to fit 4-col grid */}
                                    {app.id === 'gpay' ? 'GPay' : app.id === 'phonepe' ? 'PhonePe' : app.id === 'bhim' ? 'BHIM' : app.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Desktop / iOS note */}
                    <p className="text-[10px] text-center mb-4" style={{ color: isDark ? '#505050' : '#c0c0c0' }}>
                        App opens on Android · QR shown on desktop/iOS
                    </p>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-px" style={{ background: border }} />
                        <span className="text-xs font-medium" style={{ color: textSec }}>or</span>
                        <div className="flex-1 h-px" style={{ background: border }} />
                    </div>

                    {/* ── Enter UPI ID ──────────────────────────────────────────── */}
                    {!showUpiInput ? (
                        <button
                            id="upi-id-expand-btn"
                            onClick={() => { setShowUpiInput(true); setSheetError(null) }}
                            disabled={isLoading}
                            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] disabled:opacity-50"
                            style={{
                                backgroundColor: cardBg,
                                borderColor: border,
                                boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: isDark ? '#2a2a2a' : '#f3f4f6' }}>
                                    <Smartphone className="w-4 h-4" style={{ color: '#6366f1' }} />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-semibold" style={{ color: textPri }}>Enter UPI ID manually</p>
                                    <p className="text-xs" style={{ color: textSec }}>Any app · e.g. 9876543210@upi</p>
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4" style={{ color: textSec }} />
                        </button>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <div>
                                <label className="text-xs font-semibold mb-1.5 block" style={{ color: textSec }}>
                                    UPI ID
                                </label>
                                <input
                                    id="upi-id-manual-input"
                                    type="text"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    value={upiIdInput}
                                    onChange={e => { setUpiIdInput(e.target.value.trim()); setUpiError('') }}
                                    placeholder="9876543210@upi or name@okaxis"
                                    autoFocus
                                    className="w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-indigo-500"
                                    style={{
                                        backgroundColor: isDark ? '#2a2a2a' : '#f9fafb',
                                        borderColor: upiError ? '#ef4444' : border,
                                        color: textPri,
                                        fontSize: 15,
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpiIdSubmit() }}
                                />
                                {upiError && (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> {upiError}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setShowUpiInput(false); setUpiIdInput(''); setUpiError('') }}
                                    disabled={loadingId === 'upi-id'}
                                    className="py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
                                    style={{ borderColor: border, color: textSec, backgroundColor: 'transparent' }}
                                >
                                    Back
                                </button>
                                <button
                                    id="upi-id-pay-btn"
                                    onClick={handleUpiIdSubmit}
                                    disabled={loadingId === 'upi-id' || !upiIdInput.trim()}
                                    className="py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                                >
                                    {loadingId === 'upi-id'
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening…</>
                                        : 'Pay Now'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Security footer */}
                    <p className="text-center text-[10px] mt-5" style={{ color: isDark ? '#383838' : '#d1d5db' }}>
                        🔒 Encrypted &amp; secured by Razorpay
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
