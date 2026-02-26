'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
    Calculator, LogOut, LayoutDashboard, TrendingUp, FileText,
    IndianRupee, Sparkles, Check, X, Loader2, Clock, CreditCard
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'
import { db } from '@/lib/firebase'
import {
    collection, query, orderBy, onSnapshot,
    doc, updateDoc, serverTimestamp
} from 'firebase/firestore'

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
}

const BANK_NAMES: Record<string, string> = {
    axis: 'Axis Bank', bob: 'Bank of Baroda', boi: 'Bank of India',
    canara: 'Canara Bank', csb: 'CSB Bank', dbs: 'DBS Bank India',
    federal: 'Federal Bank', hdfc: 'HDFC Bank', hsbc: 'HSBC India',
    icici: 'ICICI Bank', idbi: 'IDBI Bank', idfc: 'IDFC First Bank',
    indusind: 'IndusInd Bank', kotak: 'Kotak Mahindra Bank',
    pnb: 'Punjab National Bank', rbl: 'RBL Bank', sbi: 'State Bank of India',
    sc: 'Standard Chartered', union: 'Union Bank of India', yes: 'YES Bank',
}

export default function AccountantDashboardPage() {
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [mounted, setMounted] = useState(false)
    const [requests, setRequests] = useState<WithdrawalRequest[]>([])
    const [processingId, setProcessingId] = useState<string | null>(null)
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

    // Real-time withdrawal requests
    useEffect(() => {
        if (!mounted) return
        const q = query(collection(db, 'withdrawalRequests'), orderBy('createdAt', 'desc'))
        const unsub = onSnapshot(q, snap => {
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as WithdrawalRequest)))
        })
        return () => unsub()
    }, [mounted])

    const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
        setProcessingId(id)
        try {
            await updateDoc(doc(db, 'withdrawalRequests', id), { status, processedAt: serverTimestamp() })
        } finally {
            setProcessingId(null)
        }
    }

    const handleLogout = () => {
        sessionStorage.removeItem('accountant_authenticated')
        sessionStorage.removeItem('accountant_name')
        sessionStorage.removeItem('accountant_username')
        router.push('/accountant')
    }

    const pending = requests.filter(r => r.status === 'pending')
    const done = requests.filter(r => r.status !== 'pending')

    const isDark = mounted && theme === 'dark'
    const cardBg = isDark ? 'rgba(28,28,28,0.8)' : 'rgba(255,255,255,0.8)'
    const textPri = isDark ? '#fff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'
    const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(229,231,235,0.8)'

    if (!mounted) return null

    const StatusBadge = ({ status }: { status: string }) => {
        const cfg = {
            pending: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
            approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: <Check className="w-3 h-3" />, label: 'Approved' },
            rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: <X className="w-3 h-3" />, label: 'Rejected' },
        }[status] || { bg: '', text: '', icon: null, label: status }
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                {cfg.icon}{cfg.label}
            </span>
        )
    }

    const RequestCard = ({ r }: { r: WithdrawalRequest }) => (
        <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border" style={{ backgroundColor: cardBg, borderColor: borderCol }}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm" style={{ color: textPri }}>{r.userName || r.uid}</p>
                        <StatusBadge status={r.status} />
                    </div>
                    <p className="text-2xl font-black" style={{ color: textPri }}>₹{r.amount.toLocaleString('en-IN')}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" style={{ color: textSec }} />
                        {r.method.type === 'bank' ? (
                            <p className="text-xs" style={{ color: textSec }}>
                                {BANK_NAMES[r.method.bankId || ''] || r.method.bankId} · ••••{r.method.accountNumber?.slice(-4)} · {r.method.ifsc}
                            </p>
                        ) : (
                            <p className="text-xs" style={{ color: textSec }}>UPI · {r.method.upiId}</p>
                        )}
                    </div>
                    {r.createdAt?.toDate && (
                        <p className="text-xs mt-1" style={{ color: textSec }}>
                            {r.createdAt.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    )}
                </div>
                {r.status === 'pending' && (
                    <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleStatus(r.id, 'approved')}
                            disabled={processingId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                            {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                        </button>
                        <button
                            onClick={() => handleStatus(r.id, 'rejected')}
                            disabled={processingId === r.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                            {processingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Reject
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    )

    return (
        <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))' }}>
            {/* Top Bar */}
            <div
                className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-xl border-b"
                style={{ backgroundColor: isDark ? 'rgba(18,18,20,0.96)' : 'rgba(255,255,255,0.85)', borderColor: borderCol }}
            >
                <div className="flex items-center gap-3">
                    <Link href="/"><Image src="/logo.jpg" alt="NeedYou" width={36} height={36} className="w-9 h-9 rounded-xl shadow" /></Link>
                    <div>
                        <h1 style={{ color: textPri }} className="font-black text-base leading-tight">Accountant Dashboard</h1>
                        <p style={{ color: isDark ? '#a5b4fc' : '#2563eb' }} className="text-xs font-medium">@{username}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle variant="inline" />
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all" style={{ color: isDark ? '#fca5a5' : '#dc2626', backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(254,242,242,1)', border: isDark ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(252,165,165,0.8)' }}>
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
                {/* Welcome Banner */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 rounded-3xl shadow-xl text-white">
                    <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center opacity-80">
                        <Sparkles className="w-4 h-4 text-white" />
                    </motion.div>
                    <p className="text-blue-200 text-sm font-semibold mb-1">Welcome back 👋</p>
                    <h2 className="text-2xl md:text-3xl font-black mb-1 text-white">{name}</h2>
                    <p className="text-blue-200 text-sm">You're signed in as an authorized NeedYou accountant.</p>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Total Requests', value: requests.length, icon: FileText, color: 'from-blue-500 to-cyan-500' },
                        { label: 'Pending', value: pending.length, icon: Clock, color: 'from-yellow-500 to-orange-500' },
                        { label: 'Processed', value: done.length, icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
                    ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                            <div className={`w-10 h-10 mb-2 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow`}>
                                <stat.icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-2xl font-black" style={{ color: textPri }}>{stat.value}</p>
                            <p className="text-xs" style={{ color: textSec }}>{stat.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Pending Requests */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-3">
                    <h2 className="font-black text-lg flex items-center gap-2" style={{ color: textPri }}>
                        <Clock className="w-5 h-5 text-yellow-500" /> Pending Requests
                        {pending.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-xs font-black">{pending.length}</span>}
                    </h2>
                    {pending.length === 0 ? (
                        <div className="text-center py-8 rounded-2xl border-2 border-dashed" style={{ borderColor: borderCol }}>
                            <IndianRupee className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: textSec }} />
                            <p className="text-sm" style={{ color: textSec }}>No pending withdrawal requests</p>
                        </div>
                    ) : (
                        pending.map(r => <RequestCard key={r.id} r={r} />)
                    )}
                </motion.div>

                {/* Processed */}
                {done.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="space-y-3">
                        <h2 className="font-black text-lg flex items-center gap-2" style={{ color: textPri }}>
                            <Check className="w-5 h-5 text-green-500" /> Processed
                        </h2>
                        {done.map(r => <RequestCard key={r.id} r={r} />)}
                    </motion.div>
                )}
            </div>
        </div>
    )
}
