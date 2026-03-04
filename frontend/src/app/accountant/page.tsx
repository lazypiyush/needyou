'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Lock, Eye, EyeOff, Calculator, ArrowRight, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

export default function AccountantLoginPage() {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    // Welcome animation state
    const [showWelcome, setShowWelcome] = useState(false)
    const [accountantName, setAccountantName] = useState('')
    const router = useRouter()
    const { theme } = useTheme()

    useEffect(() => {
        setMounted(true)
        if (typeof window !== 'undefined' && sessionStorage.getItem('accountant_authenticated') === 'true') {
            router.replace('/accountant/dashboard')
        }
    }, [router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const q = query(
                collection(db, 'accountants'),
                where('username', '==', username.trim().toLowerCase())
            )
            const snapshot = await getDocs(q)
            if (snapshot.empty) {
                setError('Invalid username or password.')
                setLoading(false)
                return
            }
            const data = snapshot.docs[0].data()
            if (data.password !== password) {
                setError('Invalid username or password.')
                setLoading(false)
                return
            }

            // Save session
            sessionStorage.setItem('accountant_authenticated', 'true')
            sessionStorage.setItem('accountant_name', data.name)
            sessionStorage.setItem('accountant_username', data.username)

            // Show welcome animation before redirecting
            setAccountantName(data.name)
            setLoading(false)
            setShowWelcome(true)

            // Navigate to dashboard after animation
            setTimeout(() => {
                router.push('/accountant/dashboard')
            }, 2800)

        } catch (err: any) {
            setError('Something went wrong. Please try again.')
            setLoading(false)
        }
    }

    return (
        <>
            <ThemeToggle />

            {/* ── Welcome Animation Overlay ── */}
            <AnimatePresence>
                {showWelcome && (
                    <motion.div
                        key="welcome-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgb(37, 99, 235), rgb(79, 70, 229), rgb(147, 51, 234))'
                        }}
                    >
                        {/* Pulsing ring */}
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: [0, 1.4, 1], opacity: [0, 0.3, 0] }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className="absolute w-64 h-64 rounded-full border-4 border-white"
                        />

                        {/* Check icon */}
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', duration: 0.7, bounce: 0.5 }}
                            className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center mb-6 shadow-2xl"
                        >
                            <CheckCircle2 className="w-10 h-10 text-white" />
                        </motion.div>

                        {/* Welcome text */}
                        <motion.p
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.5 }}
                            className="text-white/80 text-lg font-medium mb-1"
                        >
                            Welcome back 👋
                        </motion.p>

                        {/* Name */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.55, type: 'spring', duration: 0.7, bounce: 0.3 }}
                            className="text-white font-black text-4xl md:text-5xl text-center px-6 mb-6"
                        >
                            {accountantName}
                        </motion.h1>

                        {/* Sparkle row */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            className="flex items-center gap-2 text-white/70 text-sm"
                        >
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                            <span>Signing you in to NeedYou</span>
                            <Sparkles className="w-4 h-4 text-yellow-300" />
                        </motion.div>

                        {/* Progress bar */}
                        <motion.div
                            className="absolute bottom-0 left-0 h-1 bg-white/50"
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{ duration: 2.8, ease: 'linear' }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Login Form ── */}
            <div
                className="min-h-screen w-full flex items-center justify-center px-4 py-12"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
                }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    {/* Logo + Header */}
                    <div className="text-center mb-8">
                        <Link href="/">
                            <Image
                                src="/logo.jpg"
                                alt="NeedYou"
                                width={80}
                                height={80}
                                className="w-20 h-20 mx-auto rounded-2xl shadow-lg mb-4"
                            />
                        </Link>
                        <div className="inline-flex items-center gap-2 mb-2">
                            <Calculator className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Accountant Portal
                            </h1>
                        </div>
                        <p
                            className="mt-1 text-sm"
                            style={{ color: mounted && theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                        >
                            Sign in with your assigned credentials
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">

                        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                                <Calculator className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>Use the credentials assigned to you by the NeedYou admin.</span>
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Username
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <motion.button
                                type="submit"
                                disabled={loading || !username || !password || showWelcome}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Signing In...
                                    </>
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </motion.button>
                        </form>
                    </div>
                </motion.div>
            </div>
        </>
    )
}
