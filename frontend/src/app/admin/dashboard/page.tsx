'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Users, Plus, Trash2, Eye, EyeOff, Loader2, AlertCircle,
    CheckCircle2, LogOut, ShieldCheck, User, Lock, UserSquare2
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'
import { db } from '@/lib/firebase'
import {
    collection, addDoc, getDocs, deleteDoc, doc, query, orderBy,
    serverTimestamp, where, updateDoc, increment, getDoc
} from 'firebase/firestore'

interface Accountant {
    id: string
    name: string
    username: string
}

export default function AdminDashboardPage() {
    const [accountants, setAccountants] = useState<Accountant[]>([])
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [fetchLoading, setFetchLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)

    // Wallet top-up
    const [walletEmail, setWalletEmail] = useState('')
    const [walletAmount, setWalletAmount] = useState('')
    const [walletUser, setWalletUser] = useState<{ uid: string; name: string; email: string; balance: number } | null>(null)
    const [walletSearching, setWalletSearching] = useState(false)
    const [walletAdding, setWalletAdding] = useState(false)
    const [walletMsg, setWalletMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const router = useRouter()
    const { theme } = useTheme()

    useEffect(() => {
        setMounted(true)
        if (typeof window !== 'undefined') {
            if (sessionStorage.getItem('admin_authenticated') !== 'true') {
                router.replace('/admin')
                return
            }
            fetchAccountants()
        }
    }, [router])

    const fetchAccountants = async () => {
        setFetchLoading(true)
        try {
            const q = query(collection(db, 'accountants'), orderBy('createdAt', 'desc'))
            const snapshot = await getDocs(q)
            setAccountants(snapshot.docs.map(d => ({ id: d.id, name: d.data().name, username: d.data().username })))
        } catch {
            try {
                const snapshot = await getDocs(collection(db, 'accountants'))
                setAccountants(snapshot.docs.map(d => ({ id: d.id, name: d.data().name, username: d.data().username })))
            } catch { }
        } finally {
            setFetchLoading(false)
        }
    }

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        setLoading(true)
        try {
            const existing = accountants.find(a => a.username.toLowerCase() === username.trim().toLowerCase())
            if (existing) {
                setError('Username already exists. Please choose a different one.')
                setLoading(false)
                return
            }
            await addDoc(collection(db, 'accountants'), {
                name: name.trim(),
                username: username.trim().toLowerCase(),
                password,
                createdAt: serverTimestamp(),
            })
            setSuccess(`✅ Accountant "${name.trim()}" assigned successfully!`)
            setName('')
            setUsername('')
            setPassword('')
            await fetchAccountants()
        } catch {
            setError('Failed to save. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string, accName: string) => {
        if (!confirm(`Remove accountant "${accName}"? This cannot be undone.`)) return
        setDeletingId(id)
        try {
            await deleteDoc(doc(db, 'accountants', id))
            setAccountants(prev => prev.filter(a => a.id !== id))
        } catch {
            alert('Failed to delete. Please try again.')
        } finally {
            setDeletingId(null)
        }
    }

    const handleLogout = () => {
        sessionStorage.removeItem('admin_authenticated')
        router.push('/admin')
    }

    const handleWalletSearch = async () => {
        setWalletMsg(null)
        setWalletUser(null)
        if (!walletEmail.trim()) return
        setWalletSearching(true)
        try {
            const q = query(collection(db, 'users'), where('email', '==', walletEmail.trim().toLowerCase()))
            const snap = await getDocs(q)
            if (snap.empty) {
                setWalletMsg({ type: 'error', text: 'No user found with that email.' })
            } else {
                const d = snap.docs[0]
                const data = d.data()
                setWalletUser({ uid: d.id, name: data.name || data.displayName || 'User', email: data.email, balance: data.walletBalance || 0 })
            }
        } catch {
            setWalletMsg({ type: 'error', text: 'Search failed. Please try again.' })
        } finally {
            setWalletSearching(false)
        }
    }

    const handleAddBalance = async () => {
        if (!walletUser) return
        const amt = parseFloat(walletAmount)
        if (!amt || amt <= 0) return setWalletMsg({ type: 'error', text: 'Enter a valid amount.' })
        setWalletAdding(true)
        setWalletMsg(null)
        try {
            await updateDoc(doc(db, 'users', walletUser.uid), { walletBalance: increment(amt) })
            const newBal = walletUser.balance + amt
            setWalletUser(prev => prev ? { ...prev, balance: newBal } : null)
            setWalletAmount('')
            setWalletMsg({ type: 'success', text: `✅ Added ₹${amt} to ${walletUser.name}'s wallet. New balance: ₹${newBal}` })
        } catch {
            setWalletMsg({ type: 'error', text: 'Failed to add balance. Please try again.' })
        } finally {
            setWalletAdding(false)
        }
    }

    return (
        <>
            <div
                className="min-h-screen"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
                }}
            >
                {/* Top Bar */}
                <div
                    className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between backdrop-blur-xl border-b"
                    style={{
                        backgroundColor: mounted && theme === 'dark' ? 'rgba(18, 18, 20, 0.96)' : 'rgba(255, 255, 255, 0.85)',
                        borderColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(229, 231, 235, 0.8)',
                        boxShadow: mounted && theme === 'dark' ? '0 4px 24px rgba(255, 255, 255, 0.08)' : 'none',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Image src="/logo.jpg" alt="NeedYou" width={36} height={36} className="w-9 h-9 rounded-xl shadow" />
                        </Link>
                        <div>
                            <h1 style={{ color: mounted && theme === 'dark' ? '#ffffff' : '#111827' }} className="font-black text-base leading-tight">Admin Dashboard</h1>
                            <p style={{ color: mounted && theme === 'dark' ? '#a5b4fc' : '#2563eb' }} className="text-xs font-medium">NeedYou Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle variant="inline" />
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                                color: mounted && theme === 'dark' ? '#fca5a5' : '#dc2626',
                                backgroundColor: mounted && theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(254, 242, 242, 1)',
                                border: mounted && theme === 'dark' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(252, 165, 165, 0.8)',
                            }}
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

                    {/* Assign Accountant Form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                <Plus className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Assign Accountant</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Create login credentials for a new accountant</p>
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {error && (
                                <motion.div key="error" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
                                </motion.div>
                            )}
                            {success && (
                                <motion.div key="success" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                    className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-xl text-green-700 dark:text-green-300 text-sm flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{success}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <form onSubmit={handleAssign} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
                                    <div className="relative">
                                        <UserSquare2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text" required value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="e.g. Rajesh Kumar"
                                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                                {/* Username */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Username</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text" required value={username}
                                            onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                                            placeholder="e.g. rajesh_k"
                                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'} required minLength={6}
                                        value={password} onChange={e => setPassword(e.target.value)}
                                        placeholder="Set a secure password (min 6 characters)"
                                        className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <motion.button type="submit" disabled={loading || !name || !username || !password}
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Assigning...</> : <><Plus className="w-5 h-5" />Assign Accountant</>}
                            </motion.button>
                        </form>
                    </motion.div>

                    {/* Wallet Top-Up */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
                        className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Wallet Top-Up</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Search user by email and add wallet balance</p>
                            </div>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="email" value={walletEmail}
                                onChange={e => { setWalletEmail(e.target.value); setWalletUser(null); setWalletMsg(null) }}
                                onKeyDown={e => e.key === 'Enter' && handleWalletSearch()}
                                placeholder="User email address"
                                className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white text-sm"
                            />
                            <button onClick={handleWalletSearch} disabled={walletSearching || !walletEmail.trim()}
                                className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 text-sm">
                                {walletSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                            </button>
                        </div>

                        {walletUser && (
                            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-bold text-gray-900 dark:text-white">{walletUser.name}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{walletUser.email}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Current Balance</p>
                                        <p className="text-xl font-black text-green-600 dark:text-green-400">₹{walletUser.balance.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="number" min="1" value={walletAmount}
                                        onChange={e => setWalletAmount(e.target.value)}
                                        placeholder="Amount to add (₹)"
                                        className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-gray-900 dark:text-white text-sm"
                                    />
                                    <button onClick={handleAddBalance} disabled={walletAdding || !walletAmount}
                                        className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 text-sm">
                                        {walletAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Add'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {walletMsg && (
                            <div className={`mt-3 p-3 rounded-xl text-sm font-medium ${walletMsg.type === 'success'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                                }`}>{walletMsg.text}</div>
                        )}
                    </motion.div>

                    {/* Accountants List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-6 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700"
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                                <Users className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Assigned Accountants</h2>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">{accountants.length} accountant{accountants.length !== 1 ? 's' : ''} registered</p>
                            </div>
                        </div>

                        {fetchLoading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            </div>
                        ) : accountants.length === 0 ? (
                            <div className="text-center py-10">
                                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 font-medium">No accountants assigned yet.</p>
                                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Use the form above to add one.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <AnimatePresence>
                                    {accountants.map((acc, i) => (
                                        <motion.div key={acc.id}
                                            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 16 }} transition={{ delay: i * 0.04 }}
                                            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow">
                                                    {acc.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{acc.name}</p>
                                                    <p className="text-gray-500 dark:text-gray-400 text-sm">@{acc.username}</p>
                                                </div>
                                            </div>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                onClick={() => handleDelete(acc.id, acc.name)}
                                                disabled={deletingId === acc.id}
                                                className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all disabled:opacity-50"
                                            >
                                                {deletingId === acc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </motion.button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </>
    )
}
