'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    X, Wallet, Plus, Pencil, Trash2, CreditCard,
    Smartphone, ChevronDown, Check, Loader2, Building2, AlertCircle, Eye, EyeOff, ArrowDownToLine,
    Clock, History, Ban, IndianRupee
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, query, where, orderBy, onSnapshot, writeBatch, Timestamp } from 'firebase/firestore'

// ── Indian Banks ──────────────────────────────────────────────────────────────
const INDIAN_BANKS = [
    { id: 'axis', name: 'Axis Bank', short: 'AXIS', color: '#960032', scale: 1, ifscPrefix: 'UTIB', logo: 'https://companieslogo.com/img/orig/AXISBANK.BO-8f59e95b.png?t=1720244490' },
    { id: 'bob', name: 'Bank of Baroda', short: 'BOB', color: '#f7941d', scale: 1, ifscPrefix: 'BARB', logo: 'https://companieslogo.com/img/orig/BANKBARODA.NS-6790b239.png?t=1744859630' },
    { id: 'boi', name: 'Bank of India', short: 'BOI', color: '#002d72', scale: 1, ifscPrefix: 'BKID', logo: 'https://companieslogo.com/img/orig/BANKINDIA.NS-e3d88e01.png?t=1720244490' },
    { id: 'canara', name: 'Canara Bank', short: 'CAN', color: '#003087', scale: 1, ifscPrefix: 'CNRB', logo: 'https://companieslogo.com/img/orig/CANBK.NS-94324ae3.png?t=1720244491' },
    { id: 'csb', name: 'CSB Bank', short: 'CSB', color: '#009b4e', scale: 1, ifscPrefix: 'CSBK', logo: 'https://companieslogo.com/img/orig/CSBBANK.NS-648e76f9.png?t=1746536267' },
    { id: 'dbs', name: 'DBS Bank India', short: 'DBS', color: '#e60013', scale: 1, ifscPrefix: 'DBSS', logo: 'https://companieslogo.com/img/orig/D05.SI-edfcd000.png?t=1720244491' },
    { id: 'federal', name: 'Federal Bank', short: 'FED', color: '#00704a', scale: 1, ifscPrefix: 'FDRL', logo: 'https://companieslogo.com/img/orig/FEDERALBNK.NS-fe6ad2b0.png?t=1768446273' },
    { id: 'hdfc', name: 'HDFC Bank', short: 'HDFC', color: '#e31e24', scale: 1, ifscPrefix: 'HDFC', logo: 'https://companieslogo.com/img/orig/HDB-bb6241fe.png?t=1720244492' },
    { id: 'hsbc', name: 'HSBC India', short: 'HSBC', color: '#db0011', scale: 1, ifscPrefix: 'HSBC', logo: 'https://companieslogo.com/img/orig/HSBC-9c9da987.png?t=1720244492' },
    { id: 'icici', name: 'ICICI Bank', short: 'ICICI', color: '#f58220', scale: 1, ifscPrefix: 'ICIC', logo: 'https://companieslogo.com/img/orig/IBN-af38b5c0.png?t=1720244492' },
    { id: 'idbi', name: 'IDBI Bank', short: 'IDBI', color: '#003087', scale: 1, ifscPrefix: 'IBKL', logo: 'https://companieslogo.com/img/orig/IDBI.NS-1e2d35e6.png?t=1745688100' },
    { id: 'idfc', name: 'IDFC First Bank', short: 'IDFC', color: '#f28323', scale: 1, ifscPrefix: 'IDFB', logo: 'https://companieslogo.com/img/orig/IDFCFIRSTB.NS-6c6b4306.png?t=1720244492' },
    { id: 'indusind', name: 'IndusInd Bank', short: 'IIB', color: '#1a2c8b', scale: 1, ifscPrefix: 'INDB', logo: 'https://companieslogo.com/img/orig/INDUSINDBK.NS-29bfd69e.png?t=1720244492' },
    { id: 'kotak', name: 'Kotak Mahindra Bank', short: 'KMB', color: '#e31837', scale: 1, ifscPrefix: 'KKBK', logo: 'https://companieslogo.com/img/orig/KOTAKBANK.NS-36440c5e.png?t=1720244492' },
    { id: 'pnb', name: 'Punjab National Bank', short: 'PNB', color: '#c00018', scale: 1, ifscPrefix: 'PUNB', logo: 'https://companieslogo.com/img/orig/PNB.NS-f0a1e3ee.png?t=1720244493' },
    { id: 'rbl', name: 'RBL Bank', short: 'RBL', color: '#c8102e', scale: 1, ifscPrefix: 'RATN', logo: 'https://companieslogo.com/img/orig/RBLBANK.NS-eca1a0f2.png?t=1747106329' },
    { id: 'sbi', name: 'State Bank of India', short: 'SBI', color: '#006a4e', scale: 1.3, ifscPrefix: 'SBIN', logo: 'https://companieslogo.com/img/orig/SBIN.NS-6f0574a4.png?t=1720244493' },
    { id: 'sc', name: 'Standard Chartered', short: 'SCB', color: '#0071ce', scale: 1, ifscPrefix: 'SCBL', logo: 'https://companieslogo.com/img/orig/STAN.L-c30b7cd0.png?t=1720244494' },
    { id: 'union', name: 'Union Bank of India', short: 'UBI', color: '#1a3f6f', scale: 1, ifscPrefix: 'UBIN', logo: 'https://companieslogo.com/img/orig/UNIONBANK.NS-5bba728d.png?t=1720244494' },
    { id: 'yes', name: 'YES Bank', short: 'YES', color: '#6d1f7e', scale: 1, ifscPrefix: 'YESB', logo: 'https://companieslogo.com/img/orig/YESBANK.NS-a31ff15a.png?t=1720244494' },
]

const LOGO_DEV_KEY = process.env.NEXT_PUBLIC_CLEARBIT_API_KEY || ''


type PaymentType = 'bank' | 'upi'

interface BankMethod {
    id: string
    type: 'bank'
    bankId: string
    accountHolderName: string
    accountNumber: string
    ifsc: string
}

interface UpiMethod {
    id: string
    type: 'upi'
    upiId: string
    name: string
}

type PaymentMethod = BankMethod | UpiMethod

interface WalletModalProps {
    isDark: boolean
    onClose: () => void
    balance?: number
    uid?: string
    userName?: string
}

// ── Bank Logo Badge ───────────────────────────────────────────────────────────
function BankBadge({ bankId, size = 'md' }: { bankId: string; size?: 'sm' | 'md' | 'lg' }) {
    const bank = INDIAN_BANKS.find(b => b.id === bankId)
    const [error, setError] = useState(false)
    if (!bank) return null
    const px = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
    const textSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-xs' : 'text-[10px]'
    const logoSize = size === 'sm' ? 22 : size === 'lg' ? 34 : 26

    return (
        <div
            className={`${px} rounded-xl flex items-center justify-center font-black flex-shrink-0 overflow-hidden border`}
            style={{ backgroundColor: '#fff', borderColor: '#e5e7eb' }}
        >
            {!error ? (
                <img
                    src={bank.logo}
                    alt={bank.short}
                    width={Math.round(logoSize * bank.scale)}
                    height={Math.round(logoSize * bank.scale)}
                    className="object-contain"
                    onError={() => setError(true)}
                />
            ) : (
                <span className={`${textSize} font-black`} style={{ color: bank.color }}>{bank.short}</span>
            )}
        </div>
    )
}

// ── Bank Dropdown ─────────────────────────────────────────────────────────────
function BankDropdown({ value, onChange, isDark }: { value: string; onChange: (v: string) => void; isDark: boolean }) {
    const [open, setOpen] = useState(false)
    const selected = INDIAN_BANKS.find(b => b.id === value)

    const bg = isDark ? '#1e1e1e' : '#fff'
    const border = isDark ? '#333' : '#d1d5db'
    const text = isDark ? '#fff' : '#111827'
    const hover = isDark ? '#2a2a2a' : '#f9fafb'

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border text-left transition-all"
                style={{ backgroundColor: bg, borderColor: border, color: text }}
            >
                {selected ? (
                    <>
                        <BankBadge bankId={selected.id} size="sm" />
                        <span className="flex-1 text-sm font-medium">{selected.name}</span>
                    </>
                ) : (
                    <>
                        <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-gray-400" />
                        </div>
                        <span className="flex-1 text-sm" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>Select your bank</span>
                    </>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} style={{ color: isDark ? '#6b7280' : '#9ca3af' }} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 left-0 right-0 mt-1 rounded-2xl border shadow-2xl overflow-hidden"
                        style={{ backgroundColor: bg, borderColor: border, maxHeight: 280, overflowY: 'auto' }}
                    >
                        {INDIAN_BANKS.map(bank => (
                            <button
                                key={bank.id}
                                type="button"
                                onClick={() => { onChange(bank.id); setOpen(false) }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                                style={{
                                    backgroundColor: value === bank.id ? (isDark ? '#1a2a1a' : '#f0fdf4') : 'transparent',
                                }}
                                onMouseEnter={e => { if (value !== bank.id) e.currentTarget.style.backgroundColor = hover }}
                                onMouseLeave={e => { if (value !== bank.id) e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                                <BankBadge bankId={bank.id} size="sm" />
                                <span className="flex-1 text-sm font-medium" style={{ color: text }}>{bank.name}</span>
                                {value === bank.id && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function WalletModal({ isDark, onClose, balance = 0, uid = '', userName = '' }: WalletModalProps) {
    const [tab, setTab] = useState<'methods' | 'addBank' | 'addUpi' | 'withdraw' | 'history'>('methods')
    const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)

    // Saved methods — persisted to localStorage (will move to Firestore later)
    const [methods, setMethods] = useState<PaymentMethod[]>(() => {
        try {
            const stored = localStorage.getItem('wallet_methods')
            return stored ? JSON.parse(stored) : []
        } catch { return [] }
    })

    useEffect(() => {
        try { localStorage.setItem('wallet_methods', JSON.stringify(methods)) } catch { }
    }, [methods])

    // Bank form
    const [bankId, setBankId] = useState('')
    const [holderName, setHolderName] = useState('')
    const [accountNumber, setAccountNumber] = useState('')
    const [confirmAccount, setConfirmAccount] = useState('')
    const [ifsc, setIfsc] = useState('')
    const [ifscBranch, setIfscBranch] = useState<{ BRANCH: string; BANK: string; CITY: string } | null>(null)
    const [ifscLoading, setIfscLoading] = useState(false)
    const [savingBank, setSavingBank] = useState(false)
    const [showAccountNumber, setShowAccountNumber] = useState(false)

    // Live IFSC branch lookup
    useEffect(() => {
        setIfscBranch(null)
        const code = ifsc.trim().toUpperCase()
        if (code.length !== 11) return
        setIfscLoading(true)
        fetch(`https://ifsc.razorpay.com/${code}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => setIfscBranch(data ? { BRANCH: data.BRANCH, BANK: data.BANK, CITY: data.CITY } : null))
            .catch(() => setIfscBranch(null))
            .finally(() => setIfscLoading(false))
    }, [ifsc])

    // UPI form
    const [upiId, setUpiId] = useState('')
    const [savingUpi, setSavingUpi] = useState(false)

    // Withdraw form
    const [withdrawMethod, setWithdrawMethod] = useState<PaymentMethod | null>(null)
    const [withdrawAmount, setWithdrawAmount] = useState('')
    const [withdrawing, setWithdrawing] = useState(false)
    const [withdrawDone, setWithdrawDone] = useState(false)
    const [withdrawError, setWithdrawError] = useState('')

    const handleWithdraw = async () => {
        setWithdrawError('')
        const amt = Math.floor(parseFloat(withdrawAmount)) // integers only
        if (!withdrawMethod) return setWithdrawError('Please select a payment method.')
        if (!amt || amt <= 0) return setWithdrawError('Enter a valid amount.')
        if (amt < 50) return setWithdrawError('Minimum withdrawal amount is ₹50.')
        if (amt > balance) return setWithdrawError(`Amount exceeds your balance of ₹${balance.toLocaleString('en-IN')}.`)
        // Block if a pending request already exists
        const hasPending = historyRequests.some((r: any) => r.status === 'pending')
        if (hasPending) return setWithdrawError('You already have a pending withdrawal request. Please wait for it to be processed.')

        if (!uid) return setWithdrawError('User not identified. Please re-open the wallet.')
        setWithdrawing(true)
        try {
            // Atomic batch: create request + deduct wallet in one commit
            const batch = writeBatch(db)
            const reqRef = doc(collection(db, 'withdrawalRequests'))
            batch.set(reqRef, {
                uid,
                userName,
                amount: amt,
                method: withdrawMethod.type === 'bank'
                    ? { type: 'bank', bankId: withdrawMethod.bankId, accountHolderName: withdrawMethod.accountHolderName, accountNumber: withdrawMethod.accountNumber, ifsc: withdrawMethod.ifsc }
                    : { type: 'upi', upiId: withdrawMethod.upiId },
                status: 'pending',
                createdAt: Timestamp.now(), // client-side timestamp — immediately visible in orderBy queries
            })
            batch.update(doc(db, 'users', uid), { walletBalance: increment(-amt) })
            await batch.commit() // both writes succeed or both fail — no partial state
            setWithdrawDone(true)
            setWithdrawAmount('')
            setWithdrawMethod(null)
        } catch (err: any) {
            setWithdrawError('Failed to submit request. Please try again.')
        } finally {
            setWithdrawing(false)
        }
    }

    // History — real-time withdrawal requests for this user
    const [historyRequests, setHistoryRequests] = useState<any[]>([])
    useEffect(() => {
        if (!uid) return
        const q = query(
            collection(db, 'withdrawalRequests'),
            where('uid', '==', uid),
            orderBy('createdAt', 'desc')
        )
        return onSnapshot(q, snap => {
            setHistoryRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        })
    }, [uid])

    // UPI logo
    const UPI_LOGO = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/UPI-Logo-vector.svg/2560px-UPI-Logo-vector.svg.png'
    const [formError, setFormError] = useState('')

    const bg = isDark ? '#111114' : '#fff'
    const cardBg = isDark ? '#1a1a1e' : '#f9fafb'
    const border = isDark ? '#2a2a30' : '#e5e7eb'
    const textPri = isDark ? '#fff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'
    const inputCls = `w-full px-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm ${isDark ? 'bg-[#222228] border-[#333] text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
        }`
    const labelCls = `block text-xs font-semibold mb-1.5 uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`

    // ── Save bank ──────────────────────────────────────────────────────────────
    const handleSaveBank = async () => {
        setFormError('')
        if (!bankId) return setFormError('Please select a bank.')
        if (!holderName.trim()) return setFormError('Account holder name is required.')
        if (accountNumber.length < 9) return setFormError('Enter a valid account number.')
        if (accountNumber !== confirmAccount) return setFormError('Account numbers do not match.')
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) return setFormError('Enter a valid IFSC code (e.g. SBIN0001234).')
        const selectedBank = INDIAN_BANKS.find(b => b.id === bankId)
        if (selectedBank && !ifsc.toUpperCase().startsWith(selectedBank.ifscPrefix)) {
            return setFormError(`IFSC code & Bank didn't match.`)
        }

        setSavingBank(true)
        await new Promise(r => setTimeout(r, 800)) // simulate save — replace with Firestore later

        const newMethod: BankMethod = {
            id: Date.now().toString(),
            type: 'bank',
            bankId,
            accountHolderName: holderName.trim(),
            accountNumber,
            ifsc: ifsc.toUpperCase(),
        }
        setMethods(prev => {
            if (editingMethod) return prev.map(m => m.id === editingMethod.id ? newMethod : m)
            return [...prev, newMethod]
        })

        setSavingBank(false)
        resetBankForm()
        setTab('methods')
    }

    // ── Save UPI ───────────────────────────────────────────────────────────────
    const handleSaveUpi = async () => {
        setFormError('')
        if (!upiId.trim()) return setFormError('UPI ID is required.')
        if (!/^[a-zA-Z0-9.\-_]+@[a-zA-Z]+$/.test(upiId.trim())) return setFormError('Enter a valid UPI ID (e.g. name@upi).')

        setSavingUpi(true)
        await new Promise(r => setTimeout(r, 600))

        const newMethod: UpiMethod = {
            id: Date.now().toString(),
            type: 'upi',
            upiId: upiId.trim(),
            name: upiId.trim(),
        }
        setMethods(prev => {
            if (editingMethod) return prev.map(m => m.id === editingMethod.id ? newMethod : m)
            return [...prev, newMethod]
        })

        setSavingUpi(false)
        resetUpiForm()
        setTab('methods')
    }

    const resetBankForm = () => { setBankId(''); setHolderName(''); setAccountNumber(''); setConfirmAccount(''); setIfsc(''); setEditingMethod(null); setFormError('') }
    const resetUpiForm = () => { setUpiId(''); setEditingMethod(null); setFormError('') }

    const handleEditMethod = (m: PaymentMethod) => {
        setEditingMethod(m)
        if (m.type === 'bank') {
            setBankId(m.bankId); setHolderName(m.accountHolderName)
            setAccountNumber(m.accountNumber); setConfirmAccount(m.accountNumber); setIfsc(m.ifsc)
            setTab('addBank')
        } else {
            setUpiId(m.upiId)
            setTab('addUpi')
        }
    }

    const handleDeleteMethod = (id: string) => setMethods(prev => prev.filter(m => m.id !== id))

    const goBack = () => {
        if (tab !== 'methods') {
            resetBankForm(); resetUpiForm(); setTab('methods')
        } else {
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pb-16 md:pb-0" data-modal="true">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', damping: 26, stiffness: 320 }}
                className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                style={{ backgroundColor: bg, maxHeight: '85dvh', border: `1px solid ${border}` }}
            >
                {/* Header */}
                <div
                    className="flex items-center gap-3 px-5 py-4 border-b flex-shrink-0"
                    style={{ borderColor: border }}
                >
                    {tab !== 'methods' && (
                        <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <ChevronDown className="w-5 h-5 rotate-90" style={{ color: textSec }} />
                        </button>
                    )}
                    <div className="flex items-center gap-2 flex-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-base leading-tight" style={{ color: textPri }}>
                                {tab === 'methods' ? 'My Wallet'
                                    : tab === 'addBank' ? (editingMethod ? 'Edit Bank Account' : 'Add Bank Account')
                                        : tab === 'addUpi' ? (editingMethod ? 'Edit UPI ID' : 'Add UPI ID')
                                            : tab === 'withdraw' ? 'Withdraw Funds'
                                                : 'Transaction History'}
                            </h2>
                            {tab === 'methods' && <p className="text-xs" style={{ color: textSec }}>Manage your payment methods</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <X className="w-5 h-5" style={{ color: textSec }} />
                    </button>
                </div>

                {/* Scrollable Body */}
                <div className="overflow-y-auto flex-1">
                    <AnimatePresence mode="wait">

                        {/* ── Methods List ── */}
                        {tab === 'methods' && (
                            <motion.div key="methods" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-5 pb-12 md:pb-5 space-y-4">

                                {/* Balance Card */}
                                <div
                                    className="relative overflow-hidden rounded-2xl p-5"
                                    style={{ background: 'linear-gradient(135deg, #1a6fff, #6d28d9)' }}
                                >
                                    <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
                                    <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white/5" />
                                    <p className="text-blue-200 text-xs font-semibold mb-1 relative">NeedYou Wallet Balance</p>
                                    <p className="text-white text-3xl font-black relative">
                                        ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-blue-300 text-xs mt-1 relative">Earnings will appear here once implemented</p>
                                </div>

                                {/* Payment Methods */}
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: textSec }}>Payment Methods</p>
                                    {methods.length === 0 ? (
                                        <div
                                            className="rounded-2xl border-2 border-dashed p-6 text-center"
                                            style={{ borderColor: isDark ? '#2a2a30' : '#e5e7eb' }}
                                        >
                                            <CreditCard className="w-10 h-10 mx-auto mb-2" style={{ color: isDark ? '#4b5563' : '#d1d5db' }} />
                                            <p className="text-sm font-medium mb-0.5" style={{ color: textSec }}>No payment methods yet</p>
                                            <p className="text-xs" style={{ color: isDark ? '#4b5563' : '#9ca3af' }}>Add a bank account or UPI ID to receive payments</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                                            {methods.map(m => (
                                                <motion.div
                                                    key={m.id}
                                                    layout
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className="flex items-center gap-3 p-4 rounded-2xl border"
                                                    style={{ backgroundColor: cardBg, borderColor: border }}
                                                >
                                                    {m.type === 'bank' ? (
                                                        <BankBadge bankId={m.bankId} size="md" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden">
                                                            <img src={UPI_LOGO} alt="UPI" className="w-8 object-contain" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        {m.type === 'bank' ? (
                                                            <>
                                                                <p className="font-semibold text-sm truncate" style={{ color: textPri }}>
                                                                    {INDIAN_BANKS.find(b => b.id === m.bankId)?.name}
                                                                </p>
                                                                <p className="text-xs" style={{ color: textSec }}>
                                                                    ••••{m.accountNumber.slice(-4)} · {m.accountHolderName}
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="font-semibold text-sm truncate" style={{ color: textPri }}>{m.name}</p>
                                                                <p className="text-xs" style={{ color: textSec }}>{m.upiId}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 flex-shrink-0">
                                                        <button onClick={() => handleEditMethod(m)} className="p-2 rounded-xl transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20">
                                                            <Pencil className="w-4 h-4 text-blue-500" />
                                                        </button>
                                                        <button onClick={() => handleDeleteMethod(m.id)} className="p-2 rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-900/20">
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Buttons */}
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <button
                                        onClick={() => { resetBankForm(); setTab('addBank') }}
                                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 group"
                                        style={{ borderColor: isDark ? '#2a2a30' : '#e5e7eb' }}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold" style={{ color: textPri }}>Bank Account</p>
                                            <p className="text-xs" style={{ color: textSec }}>Add bank details</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => { resetUpiForm(); setTab('addUpi') }}
                                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 group"
                                        style={{ borderColor: isDark ? '#2a2a30' : '#e5e7eb' }}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform overflow-hidden">
                                            <img src={UPI_LOGO} alt="UPI" className="w-8 object-contain" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold" style={{ color: textPri }}>UPI ID</p>
                                            <p className="text-xs" style={{ color: textSec }}>Add UPI address</p>
                                        </div>
                                    </button>
                                </div>

                                {/* Withdraw + History buttons */}
                                {methods.length > 0 && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => { setWithdrawDone(false); setWithdrawError(''); setWithdrawAmount(''); setWithdrawMethod(null); setTab('withdraw') }}
                                            className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md hover:shadow-lg transition-all"
                                        >
                                            <ArrowDownToLine className="w-4 h-4" /> Withdraw
                                        </button>
                                        <button
                                            onClick={() => setTab('history')}
                                            className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm border-2 transition-all"
                                            style={{ borderColor: border, color: textPri }}
                                        >
                                            <History className="w-4 h-4" /> History
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── Add Bank Account ── */}
                        {tab === 'addBank' && (
                            <motion.div key="addBank" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 pb-12 md:pb-5 space-y-4">
                                {formError && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className={labelCls}>Select Bank</label>
                                    <BankDropdown value={bankId} onChange={setBankId} isDark={isDark} />
                                </div>

                                <div>
                                    <label className={labelCls}>Account Holder Name</label>
                                    <input
                                        type="text" value={holderName} onChange={e => setHolderName(e.target.value)}
                                        placeholder="As per bank records" className={inputCls}
                                    />
                                </div>

                                <div>
                                    <label className={labelCls}>Account Number</label>
                                    <div className="relative">
                                        <input
                                            type={showAccountNumber ? 'text' : 'password'} value={accountNumber}
                                            onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Enter account number" className={inputCls}
                                            style={{ paddingRight: '2.75rem' }}
                                        />
                                        <button
                                            type="button" onClick={() => setShowAccountNumber(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className={labelCls}>Re-enter Account Number</label>
                                    <input
                                        type="text" value={confirmAccount}
                                        onChange={e => setConfirmAccount(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Confirm account number" className={inputCls}
                                    />
                                    {confirmAccount && accountNumber && confirmAccount !== accountNumber && (
                                        <p className="text-xs text-red-500 mt-1">Numbers do not match</p>
                                    )}
                                </div>

                                <div>
                                    <label className={labelCls}>IFSC Code</label>
                                    <input
                                        type="text" value={ifsc}
                                        onChange={e => setIfsc(e.target.value.toUpperCase())}
                                        maxLength={11} placeholder="e.g. SBIN0001234" className={inputCls}
                                    />
                                    {ifscLoading && (
                                        <p className="text-xs mt-1.5 text-blue-500 flex items-center gap-1">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Looking up branch…
                                        </p>
                                    )}
                                    {!ifscLoading && ifscBranch && (() => {
                                        const selBank = INDIAN_BANKS.find(b => b.id === bankId)
                                        const bankMatches = !selBank || ifsc.toUpperCase().startsWith(selBank.ifscPrefix)
                                        return bankMatches ? (
                                            <p className="text-xs mt-1.5 font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                                                <Check className="w-3 h-3" />
                                                {ifscBranch.BRANCH} — {ifscBranch.CITY}
                                            </p>
                                        ) : (
                                            <p className="text-xs mt-1.5 font-medium text-orange-500 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Bank & IFSC code don't match
                                            </p>
                                        )
                                    })()}
                                    {!ifscLoading && ifsc.length === 11 && !ifscBranch && (
                                        <p className="text-xs mt-1.5 text-red-500">Invalid IFSC code</p>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button onClick={goBack} className="flex-1 py-3 rounded-xl border font-semibold text-sm" style={{ borderColor: border, color: textSec }}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveBank}
                                        disabled={savingBank || !ifscBranch || ifscLoading || (!!bankId && !ifsc.toUpperCase().startsWith(INDIAN_BANKS.find(b => b.id === bankId)?.ifscPrefix ?? ''))}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                                    >
                                        {savingBank ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><CreditCard className="w-4 h-4" /> {editingMethod ? 'Update' : 'Save'} Account</>}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Add UPI ── */}
                        {tab === 'addUpi' && (
                            <motion.div key="addUpi" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 pb-12 md:pb-5 space-y-4">
                                {formError && (
                                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-700 dark:text-red-300">{formError}</p>
                                    </div>
                                )}

                                <div
                                    className="p-4 rounded-2xl border"
                                    style={{ backgroundColor: isDark ? '#1a1a2e' : '#f5f3ff', borderColor: isDark ? '#2d2d4e' : '#e9d5ff' }}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Smartphone className="w-4 h-4 text-purple-500" />
                                        <p className="text-sm font-semibold" style={{ color: isDark ? '#c4b5fd' : '#6d28d9' }}>UPI ID Format</p>
                                    </div>
                                    <p className="text-xs" style={{ color: isDark ? '#8b7cf8' : '#7c3aed' }}>
                                        Example: <span className="font-mono font-bold">yourname@paytm</span>, <span className="font-mono font-bold">mobile@ybl</span>, <span className="font-mono font-bold">name@okaxis</span>
                                    </p>
                                </div>


                                <div>
                                    <label className={labelCls}>UPI ID</label>
                                    <input
                                        type="text" value={upiId}
                                        onChange={e => setUpiId(e.target.value.toLowerCase())}
                                        placeholder="yourname@upi" className={inputCls}
                                    />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button onClick={goBack} className="flex-1 py-3 rounded-xl border font-semibold text-sm" style={{ borderColor: border, color: textSec }}>
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveUpi}
                                        disabled={savingUpi}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2"
                                    >
                                        {savingUpi ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Smartphone className="w-4 h-4" /> {editingMethod ? 'Update' : 'Save'} UPI ID</>}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* ── Withdraw ── */}
                        {tab === 'withdraw' && (
                            <motion.div key="withdraw" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 pb-12 md:pb-5 space-y-5">
                                {/* Balance */}
                                <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                    <p className="text-green-100 text-xs font-semibold uppercase tracking-wide mb-1">Available Balance</p>
                                    <p className="text-white text-3xl font-black">₹{balance.toLocaleString('en-IN')}</p>
                                </div>
                                {withdrawDone ? (
                                    <div className="text-center py-6 space-y-3">
                                        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                                            <Check className="w-8 h-8 text-green-500" />
                                        </div>
                                        <p className="font-bold text-lg" style={{ color: textPri }}>Request Submitted!</p>
                                        <p className="text-sm" style={{ color: textSec }}>Your withdrawal request has been sent to the accountant for processing.</p>
                                        <button onClick={() => { setWithdrawDone(false); setTab('methods') }} className="mt-2 px-6 py-2 rounded-xl bg-green-500 text-white font-semibold text-sm">Done</button>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className={labelCls}>Select Payment Method</label>
                                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                                {methods.map(m => (
                                                    <button
                                                        key={m.id}
                                                        onClick={() => setWithdrawMethod(m)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                                                        style={{ backgroundColor: withdrawMethod?.id === m.id ? (isDark ? '#052e16' : '#f0fdf4') : cardBg, borderColor: withdrawMethod?.id === m.id ? '#10b981' : border }}
                                                    >
                                                        {m.type === 'bank' ? (
                                                            <BankBadge bankId={m.bankId} size="sm" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                <img src={UPI_LOGO} alt="UPI" className="w-6 object-contain" />
                                                            </div>
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            {m.type === 'bank' ? (
                                                                <>
                                                                    <p className="text-sm font-semibold truncate" style={{ color: textPri }}>{INDIAN_BANKS.find(b => b.id === m.bankId)?.name}</p>
                                                                    <p className="text-xs" style={{ color: textSec }}>••••{m.accountNumber.slice(-4)} · {m.accountHolderName}</p>
                                                                </>
                                                            ) : (
                                                                <p className="text-sm font-semibold truncate" style={{ color: textPri }}>{m.upiId}</p>
                                                            )}
                                                        </div>
                                                        {withdrawMethod?.id === m.id && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Amount (₹)</label>
                                            <input
                                                type="number" min="50" max={balance} step="1"
                                                value={withdrawAmount}
                                                onChange={e => setWithdrawAmount(e.target.value ? String(Math.floor(Number(e.target.value))) : '')}
                                                placeholder="Enter whole amount (e.g. 500)"
                                                className={inputCls}
                                            />
                                            <p className="text-xs mt-1.5" style={{ color: textSec }}>
                                                Min ₹50 · Max ₹{balance.toLocaleString('en-IN')} · Whole rupees only
                                            </p>
                                        </div>
                                        {withdrawError && (
                                            <p className="text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {withdrawError}</p>
                                        )}
                                        <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                            <button onClick={() => setTab('methods')} className="sm:flex-1 py-3 rounded-xl border font-semibold text-sm" style={{ borderColor: border, color: textSec }}>Cancel</button>
                                            <button
                                                onClick={handleWithdraw}
                                                disabled={withdrawing || !withdrawMethod || !withdrawAmount}
                                                className="sm:flex-1 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                                            >
                                                {withdrawing ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><ArrowDownToLine className="w-4 h-4" /> Submit Request</>}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* ── History ── */}
                        {tab === 'history' && (
                            <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-5 pb-12 md:pb-5 space-y-4">
                                {historyRequests.length === 0 ? (
                                    <div className="text-center py-10 space-y-2">
                                        <Clock className="w-10 h-10 mx-auto opacity-20" style={{ color: textSec }} />
                                        <p className="text-sm font-medium" style={{ color: textSec }}>No withdrawal requests yet</p>
                                    </div>
                                ) : (
                                    historyRequests.map((req: any) => {
                                        const methodLabel = req.method?.type === 'bank'
                                            ? `${INDIAN_BANKS.find((b: any) => b.id === req.method?.bankId)?.name || 'Bank'} ••••${(req.method?.accountNumber || '').slice(-4)}`
                                            : req.method?.upiId || 'UPI'
                                        const date = req.createdAt?.toDate?.()?.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) || ''
                                        return (
                                            <motion.div key={req.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                                className="rounded-2xl border overflow-hidden"
                                                style={{ backgroundColor: cardBg, borderColor: border }}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: border }}>
                                                    <div>
                                                        <p className="font-bold text-sm" style={{ color: textPri }}>₹{req.amount?.toLocaleString('en-IN')}</p>
                                                        <p className="text-xs" style={{ color: textSec }}>{date}</p>
                                                    </div>
                                                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                                        {req.status === 'approved' ? 'Approved' : req.status === 'rejected' ? 'Rejected' : 'Pending'}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-3 space-y-2">
                                                    <p className="text-xs" style={{ color: textSec }}>To: <span className="font-semibold" style={{ color: textPri }}>{methodLabel}</span></p>
                                                    {req.status === 'pending' && (<div className="flex items-center gap-1.5 text-xs text-yellow-600 dark:text-yellow-400"><Clock className="w-3.5 h-3.5" /> Waiting for accountant review</div>)}
                                                    {req.status === 'approved' && (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"><Check className="w-3.5 h-3.5" /> Payment sent to your {req.method?.type === 'bank' ? 'bank account' : 'UPI ID'}</div>
                                                            {req.txnId && <p className="text-xs font-mono" style={{ color: textSec }}>TXN: {req.txnId}</p>}
                                                        </div>
                                                    )}
                                                    {req.status === 'rejected' && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-1.5 text-xs text-red-500"><Ban className="w-3.5 h-3.5" /> Request rejected</div>
                                                            {req.rejectionReason && (
                                                                <div className="p-2.5 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fff5f5', border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : '#fca5a5'}` }}>
                                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5">Reason</p>
                                                                    <p className="text-xs" style={{ color: textPri }}>{req.rejectionReason}</p>
                                                                </div>
                                                            )}
                                                            {req.rejectionImageUrl && (
                                                                <a href={req.rejectionImageUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-500 hover:underline">
                                                                    <IndianRupee className="w-3 h-3" /> View attached image
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )
                                    })
                                )}
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
}
