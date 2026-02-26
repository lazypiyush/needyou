'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Calculator, LogOut, LayoutDashboard, TrendingUp, FileText, IndianRupee, Sparkles } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'

export default function AccountantDashboardPage() {
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [mounted, setMounted] = useState(false)
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

    const handleLogout = () => {
        sessionStorage.removeItem('accountant_authenticated')
        sessionStorage.removeItem('accountant_name')
        sessionStorage.removeItem('accountant_username')
        router.push('/accountant')
    }

    const stats = [
        { label: 'Total Transactions', value: '—', icon: TrendingUp, color: 'from-blue-500 to-cyan-500' },
        { label: 'Pending Reports', value: '—', icon: FileText, color: 'from-purple-500 to-pink-500' },
        { label: 'Month Revenue', value: '—', icon: IndianRupee, color: 'from-green-500 to-emerald-500' },
    ]

    if (!mounted) return null

    return (
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
                        <h1 style={{ color: mounted && theme === 'dark' ? '#ffffff' : '#111827' }} className="font-black text-base leading-tight">Accountant Dashboard</h1>
                        <p style={{ color: mounted && theme === 'dark' ? '#a5b4fc' : '#2563eb' }} className="text-xs font-medium">@{username}</p>
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

                {/* Welcome Banner */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 rounded-3xl shadow-xl text-white"
                >
                    {/* Decorative sparkles */}
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center opacity-80"
                    >
                        <Sparkles className="w-4 h-4 text-white" />
                    </motion.div>
                    <div className="relative">
                        <p className="text-blue-200 text-sm font-semibold mb-1">Welcome back 👋</p>
                        <h2
                            className="text-2xl md:text-3xl font-black mb-1"
                            style={{ color: mounted && theme === 'dark' ? '#ffffff' : '#ffffff' }}
                        >
                            {name}
                        </h2>
                        <p className="text-blue-200 text-sm">You're signed in as an authorized NeedYou accountant.</p>
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
                            whileHover={{ y: -6 }}
                            className="group relative bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-5 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
                        >
                            <div className={`w-12 h-12 mb-3 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                                <stat.icon className="w-6 h-6 text-white" />
                            </div>
                            <p
                                className="text-2xl font-black"
                                style={{ color: mounted && theme === 'dark' ? '#ffffff' : '#1f2937' }}
                            >
                                {stat.value}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{stat.label}</p>
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`} />
                        </motion.div>
                    ))}
                </div>

                {/* Coming Soon Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    whileHover={{ y: -4 }}
                    className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 text-center"
                >
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <LayoutDashboard className="w-8 h-8 text-white" />
                    </div>
                    <h3
                        className="font-bold text-xl mb-2"
                        style={{ color: mounted && theme === 'dark' ? '#ffffff' : '#1f2937' }}
                    >
                        More Features Coming Soon
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mx-auto">
                        Financial records, transaction history, monthly reports, and more will be available here soon.
                    </p>
                </motion.div>

            </div>
        </div>
    )
}
