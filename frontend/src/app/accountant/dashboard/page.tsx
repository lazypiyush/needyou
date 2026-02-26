'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Calculator, LogOut, Sparkles, Check, X, Loader2, Clock,
    CreditCard, Upload, IndianRupee, TrendingUp, FileText,
    ChevronDown, Search, User, History, Receipt
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'
import { db, storage } from '@/lib/firebase'
import {
    collection, query, orderBy, onSnapshot,
    doc, updateDoc, serverTimestamp, getDocs, where, increment
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

interface WithdrawalRequest {
    id: string
    uid: string
    userName: string
    amount: number
    method: {
        type: 'bank' | 'upi'
        bankId?: string
        accountHolderName?: string
        accountNumber?: string
        ifsc?: string
        upiId?: string
    }
    status: 'pending' | 'approved' | 'rejected'
    createdAt: any
    processedAt?: any
    paymentProofUrl?: string
    txnId?: string
    rejectionReason?: string
    rejectionImageUrl?: string
}

const PLATFORM_FEE_PCT = 5
const BANK_NAMES: Record<string, string> = {
    axis: 'Axis Bank', bob: 'Bank of Baroda', boi: 'Bank of India',
    canara: 'Canara Bank', csb: 'CSB Bank', dbs: 'DBS Bank India',
    federal: 'Federal Bank', hdfc: 'HDFC Bank', hsbc: 'HSBC India',
    icici: 'ICICI Bank', idbi: 'IDBI Bank', idfc: 'IDFC First Bank',
    indusind: 'IndusInd Bank', kotak: 'Kotak Mahindra Bank',
    pnb: 'Punjab National Bank', rbl: 'RBL Bank', sbi: 'State Bank of India',
    sc: 'Standard Chartered', union: 'Union Bank of India', yes: 'YES Bank',
}

function StatusBadge({ status }: { status: string }) {
    const cfg: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
        pending: { cls: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
        approved: { cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300', label: 'Approved', icon: <Check className="w-3 h-3" /> },
        rejected: { cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300', label: 'Rejected', icon: <X className="w-3 h-3" /> },
    }
    const c = cfg[status] || cfg.pending
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${c.cls}`}>
            {c.icon}{c.label}
        </span>
    )
}

function RequestCard({ r, isDark, photoURL }: { r: WithdrawalRequest; isDark: boolean; photoURL?: string }) {
    const [expanded, setExpanded] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [proofUrl, setProofUrl] = useState(r.paymentProofUrl || '')
    const [txnId, setTxnId] = useState(r.txnId || '')
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [rejectImgUrl, setRejectImgUrl] = useState('')
    const [uploadingRejectImg, setUploadingRejectImg] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)
    const rejectImgRef = useRef<HTMLInputElement>(null)

    const fee = +(r.amount * PLATFORM_FEE_PCT / 100).toFixed(2)
    const payout = +(r.amount - fee).toFixed(2)

    const cardBg = isDark ? 'rgba(28,28,28,0.9)' : '#fff'
    const border = isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'
    const textPri = isDark ? '#fff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'

    const handleStatus = async (status: 'approved' | 'rejected') => {
        if (status === 'rejected' && !showRejectForm) {
            setShowRejectForm(true)
            return
        }
        setProcessing(true)
        try {
            await updateDoc(doc(db, 'withdrawalRequests', r.id), {
                status,
                processedAt: serverTimestamp(),
                ...(proofUrl ? { paymentProofUrl: proofUrl } : {}),
                ...(txnId.trim() ? { txnId: txnId.trim() } : {}),
                ...(status === 'rejected' ? { rejectionReason: rejectReason.trim(), rejectionImageUrl: rejectImgUrl } : {}),
            })
            // Refund wallet on rejection
            if (status === 'rejected') {
                await updateDoc(doc(db, 'users', r.uid), { walletBalance: increment(r.amount) })
            }
            setShowRejectForm(false)
        } finally {
            setProcessing(false)
        }
    }

    const handleRejectImageUpload = async (file: File) => {
        setUploadingRejectImg(true)
        try {
            const storageRef = ref(storage, `rejectionImages/${r.id}_${Date.now()}`)
            await uploadBytes(storageRef, file)
            setRejectImgUrl(await getDownloadURL(storageRef))
        } finally {
            setUploadingRejectImg(false)
        }
    }

    const handleProofUpload = async (file: File) => {
        setUploading(true)
        try {
            const storageRef = ref(storage, `paymentProofs/${r.id}_${Date.now()}`)
            await uploadBytes(storageRef, file)
            const url = await getDownloadURL(storageRef)
            setProofUrl(url)
            await updateDoc(doc(db, 'withdrawalRequests', r.id), { paymentProofUrl: url })
        } finally {
            setUploading(false)
        }
    }

    return (
        <motion.div
            layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border overflow-hidden shadow-sm"
            style={{ backgroundColor: cardBg, borderColor: border }}
        >
            {/* Card header — click to expand/collapse */}
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ borderBottom: expanded ? `1px solid ${border}` : 'none' }}
            >
                <div className="flex items-center gap-2">
                    {photoURL ? (
                        <img src={photoURL} alt={r.userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/20" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {(r.userName || r.uid).charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <p className="font-bold text-sm" style={{ color: textPri }}>{r.userName || r.uid}</p>
                        {r.createdAt?.toDate && (
                            <p className="text-xs" style={{ color: textSec }}>
                                {r.createdAt.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-base font-black" style={{ color: textPri }}>₹{r.amount.toLocaleString('en-IN')}</p>
                    <StatusBadge status={r.status} />
                    <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown className="w-4 h-4" style={{ color: textSec }} />
                    </motion.div>
                </div>
            </button>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >

                        <div className="p-4 space-y-4">

                            {/* Payment details */}
                            <div className="space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: textSec }}>Payment Details</p>
                                {r.method.type === 'bank' ? (
                                    <div className="space-y-3">
                                        <InfoRow label="Bank" value={BANK_NAMES[r.method.bankId || ''] || r.method.bankId || '—'} textSec={textSec} textPri={textPri} />
                                        <InfoRow label="Account Holder" value={r.method.accountHolderName || '—'} textSec={textSec} textPri={textPri} />
                                        <InfoRow label="Account Number" value={r.method.accountNumber || '—'} textSec={textSec} textPri={textPri} mono />
                                        <InfoRow label="IFSC Code" value={r.method.ifsc || '—'} textSec={textSec} textPri={textPri} mono />
                                    </div>
                                ) : (
                                    <InfoRow label="UPI ID" value={r.method.upiId || '—'} textSec={textSec} textPri={textPri} mono />
                                )}
                            </div>

                            <div className="border-t" style={{ borderColor: border }} />

                            {/* Fee breakdown */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: textSec }}>Amount & Fees</p>
                                <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb', border: `1px solid ${border}` }}>
                                    <FeeRow label="Requested Amount" value={`₹${r.amount.toLocaleString('en-IN')}`} textSec={textSec} textPri={textPri} />
                                    <FeeRow label={`Platform Fee (${PLATFORM_FEE_PCT}%)`} value={`− ₹${fee}`} textSec={textSec} textPri="#ef4444" />
                                    <div className="border-t pt-2" style={{ borderColor: border }}>
                                        <FeeRow label="Final Payout" value={`₹${payout.toLocaleString('en-IN')}`} textSec={textSec} textPri="#10b981" bold />
                                    </div>
                                </div>
                            </div>

                            <div className="border-t" style={{ borderColor: border }} />

                            {/* TXN ID */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textSec }}>Transaction ID <span className="text-red-500">*</span></p>
                                <input
                                    type="text" value={txnId}
                                    onChange={e => setTxnId(e.target.value)}
                                    onBlur={async () => {
                                        if (txnId.trim()) await updateDoc(doc(db, 'withdrawalRequests', r.id), { txnId: txnId.trim() })
                                    }}
                                    placeholder="Enter TXN / UTR reference…"
                                    className="w-full px-3 py-2 rounded-xl border text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500"
                                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#f9fafb', borderColor: border, color: textSec }}
                                />
                            </div>

                            {/* Payment proof */}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: textSec }}>Payment Proof <span className="text-red-500">*</span></p>
                                {proofUrl ? (
                                    <a href={proofUrl} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-2 text-blue-500 text-sm font-medium hover:underline">
                                        <FileText className="w-4 h-4" /> View Uploaded Proof
                                    </a>
                                ) : (
                                    <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:border-blue-400 disabled:opacity-50"
                                        style={{ borderColor: border, color: textSec }}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                        {uploading ? 'Uploading…' : 'Upload Payment Proof'}
                                    </button>
                                )}
                                <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) handleProofUpload(e.target.files[0]) }} />
                            </div>

                            {/* Reject reason inline form */}
                            {showRejectForm && (
                                <div className="mx-4 mb-4 p-4 rounded-2xl border-2 border-red-300 dark:border-red-800 space-y-3" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : '#fff5f5' }}>
                                    <p className="text-sm font-bold text-red-600 dark:text-red-400">Rejection Reason</p>
                                    <textarea
                                        value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Explain why this request is being rejected…"
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-red-400 resize-none"
                                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#fff', borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5', color: textPri }}
                                    />
                                    <div>
                                        <p className="text-xs font-semibold mb-2" style={{ color: textSec }}>Attach Image (optional)</p>
                                        {rejectImgUrl ? (
                                            <a href={rejectImgUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-500 text-sm hover:underline">
                                                <FileText className="w-4 h-4" /> View Attached Image
                                            </a>
                                        ) : (
                                            <button onClick={() => rejectImgRef.current?.click()} disabled={uploadingRejectImg}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed text-sm transition-all hover:border-red-400 disabled:opacity-50"
                                                style={{ borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#fca5a5', color: textSec }}>
                                                {uploadingRejectImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                {uploadingRejectImg ? 'Uploading…' : 'Attach Image'}
                                            </button>
                                        )}
                                        <input ref={rejectImgRef} type="file" accept="image/*" className="hidden"
                                            onChange={e => { if (e.target.files?.[0]) handleRejectImageUpload(e.target.files[0]) }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setShowRejectForm(false)} className="flex-1 py-2 rounded-xl border text-sm font-bold" style={{ borderColor: isDark ? '#333' : '#e5e7eb', color: textSec }}>Cancel</button>
                                        <button onClick={() => handleStatus('rejected')} disabled={processing || !rejectReason.trim()}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-50">
                                            {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Confirm Reject
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            {r.status === 'pending' && (
                                <div className="flex gap-2 pt-2 border-t" style={{ borderColor: border }}>
                                    <button onClick={() => handleStatus('rejected')} disabled={processing}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                                        {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Reject
                                    </button>
                                    <button onClick={() => handleStatus('approved')} disabled={processing || !txnId.trim() || !proofUrl}
                                        title={!txnId.trim() || !proofUrl ? 'Add TXN ID and payment proof first' : ''}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                        {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

function InfoRow({ label, value, textSec, textPri, mono }: { label: string; value: string; textSec: string; textPri: string; mono?: boolean }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: textSec }}>{label}</p>
            <p className={`text-sm font-bold ${mono ? 'font-mono' : ''}`} style={{ color: textPri }}>{value}</p>
        </div>
    )
}

function FeeRow({ label, value, textSec, textPri, bold }: { label: string; value: string; textSec: string; textPri: string; bold?: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <p className={`text-sm ${bold ? 'font-bold' : ''}`} style={{ color: textSec }}>{label}</p>
            <p className={`text-sm ${bold ? 'font-black' : 'font-semibold'}`} style={{ color: textPri }}>{value}</p>
        </div>
    )
}

export default function AccountantDashboardPage() {
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [mounted, setMounted] = useState(false)
    const [requests, setRequests] = useState<WithdrawalRequest[]>([])
    const [userProfiles, setUserProfiles] = useState<Record<string, { email?: string; phone?: string; photoURL?: string }>>({})
    const [searchQuery, setSearchQuery] = useState('')
    const [mainTab, setMainTab] = useState<'pending' | 'history'>('pending')
    const router = useRouter()
    const { theme } = useTheme()

    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (sessionStorage.getItem('accountant_authenticated') !== 'true') {
                router.replace('/accountant')
                return
            }
            setName(sessionStorage.getItem('accountant_name') || 'Accountant')
            setUsername(sessionStorage.getItem('accountant_username') || '')
            setMounted(true)
        }
    }, [router])

    useEffect(() => {
        if (!mounted) return
        const q = query(collection(db, 'withdrawalRequests'), orderBy('createdAt', 'desc'))
        return onSnapshot(q, async snap => {
            const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest))
            setRequests(reqs)
            // Batch-load user profiles for all unique uids
            const uids = [...new Set(reqs.map(r => r.uid))].filter(Boolean)
            if (uids.length === 0) return
            // Firestore 'in' query supports up to 30 items
            const chunks: string[][] = []
            for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30))
            const profiles: Record<string, { email?: string; phone?: string; photoURL?: string }> = {}
            await Promise.all(chunks.map(async chunk => {
                const snap2 = await getDocs(query(collection(db, 'users'), where('__name__', 'in', chunk)))
                snap2.forEach(d => { profiles[d.id] = { email: d.data().email, phone: d.data().phoneNumber, photoURL: d.data().photoURL } })
            }))
            setUserProfiles(profiles)
        })
    }, [mounted])

    const handleLogout = () => {
        sessionStorage.removeItem('accountant_authenticated')
        sessionStorage.removeItem('accountant_name')
        sessionStorage.removeItem('accountant_username')
        router.push('/accountant')
    }

    const isDark = mounted && theme === 'dark'
    const textPri = isDark ? '#fff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'
    const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(229,231,235,0.8)'

    // Unique users for filter
    const uniqueUsers = Array.from(new Map(requests.map(r => [r.uid, r.userName || r.uid])).entries())

    const filtered = requests.filter(r => {
        const q = searchQuery.trim().toLowerCase()
        const profile = userProfiles[r.uid] || {}
        const matchUser = !q || (
            (r.userName || '').toLowerCase().includes(q) ||
            r.uid.toLowerCase().includes(q) ||
            (profile.email || '').toLowerCase().includes(q) ||
            (profile.phone || '').toLowerCase().includes(q)
        )
        const matchTab = mainTab === 'pending' ? r.status === 'pending' : r.status !== 'pending'
        return matchUser && matchTab
    })

    if (!mounted) return null

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))' }}>
            {/* Top Bar */}
            <div className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-xl border-b"
                style={{ backgroundColor: isDark ? 'rgba(18,18,20,0.96)' : 'rgba(255,255,255,0.85)', borderColor: border }}>
                <div className="flex items-center gap-3">
                    <Link href="/"><Image src="/logo.jpg" alt="NeedYou" width={36} height={36} className="w-9 h-9 rounded-xl shadow" /></Link>
                    <div>
                        <h1 style={{ color: textPri }} className="font-black text-base leading-tight">Accountant Dashboard</h1>
                        <p style={{ color: isDark ? '#a5b4fc' : '#2563eb' }} className="text-xs font-medium">@{username}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle variant="inline" />
                    <button onClick={handleLogout}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ color: isDark ? '#fca5a5' : '#dc2626', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(254,242,242,1)', border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(252,165,165,0.8)' }}>
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
                {/* Welcome */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 rounded-3xl text-white shadow-xl">
                    <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center opacity-80">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </motion.div>
                    <p className="text-blue-200 text-sm mb-0.5">Welcome back 👋</p>
                    <h2 className="text-2xl font-black">{name}</h2>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total', value: requests.length, icon: FileText, color: 'from-blue-500 to-cyan-500' },
                        { label: 'Pending', value: requests.filter(r => r.status === 'pending').length, icon: Clock, color: 'from-yellow-500 to-orange-400' },
                        { label: 'Done', value: requests.filter(r => r.status !== 'pending').length, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
                    ].map((s, i) => (
                        <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                            className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-4 rounded-2xl shadow border border-gray-200 dark:border-gray-700">
                            <div className={`w-9 h-9 mb-2 bg-gradient-to-br ${s.color} rounded-xl flex items-center justify-center`}>
                                <s.icon className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-2xl font-black" style={{ color: textPri }}>{s.value}</p>
                            <p className="text-xs" style={{ color: textSec }}>{s.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Controls: main tabs + user filter */}
                <div className="flex items-center gap-3">
                    {/* Main tabs */}
                    <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: border }}>
                        {([['pending', <Clock className="w-4 h-4" />, 'Pending'], ['history', <History className="w-4 h-4" />, 'History']] as const).map(([t, icon, label]) => (
                            <button key={t} onClick={() => setMainTab(t as 'pending' | 'history')}
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition-all ${mainTab === t
                                    ? 'bg-blue-600 text-white'
                                    : isDark ? 'bg-[#1c1c1c] text-gray-400' : 'bg-white text-gray-500'
                                    }`}>
                                {icon}{label}
                            </button>
                        ))}
                    </div>

                    {/* User search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textSec }} />
                        <input
                            type="text" value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, email or phone…"
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border outline-none"
                            style={{ backgroundColor: isDark ? '#1c1c1c' : '#fff', borderColor: border, color: textPri }}
                        />
                    </div>
                </div>

                {/* Request list */}
                <AnimatePresence>
                    {filtered.length === 0 ? (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="text-center py-12 rounded-2xl border-2 border-dashed" style={{ borderColor: border }}>
                            <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: textSec }} />
                            <p className="text-sm font-medium" style={{ color: textSec }}>
                                {mainTab === 'pending' ? 'No pending requests' : 'No history yet'}
                            </p>
                        </motion.div>
                    ) : (
                        <div className="space-y-4">
                            {filtered.map(r => <RequestCard key={r.id} r={r} isDark={isDark} photoURL={userProfiles[r.uid]?.photoURL} />)}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
