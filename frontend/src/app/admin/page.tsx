'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'

export default function AdminLoginPage() {
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [mounted, setMounted] = useState(false)
    const router = useRouter()
    const { theme } = useTheme()

    useEffect(() => {
        setMounted(true)
        if (typeof window !== 'undefined' && sessionStorage.getItem('admin_authenticated') === 'true') {
            router.replace('/admin/dashboard')
        }
    }, [router])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        await new Promise(resolve => setTimeout(resolve, 500))
        const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD
        if (password === adminPassword) {
            sessionStorage.setItem('admin_authenticated', 'true')
            router.push('/admin/dashboard')
        } else {
            setError('Incorrect password. Please try again.')
            setLoading(false)
        }
    }

    return (
        <>
            <ThemeToggle />
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
                            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Admin Panel
                            </h1>
                        </div>
                        <p
                            className="mt-1 text-sm"
                            style={{ color: mounted && theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                        >
                            Authorized access only
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">

                        {/* Info Badge */}
                        <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span>This area is restricted to NeedYou administrators only.</span>
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Admin Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Enter admin password"
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
                                disabled={loading || !password}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    <>
                                        Access Panel
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
