'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTheme } from 'next-themes'
import { applyToJob } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'

interface JobApplicationModalProps {
    job: {
        id: string
        caption: string
        budget: number
    }
    onClose: () => void
    onSuccess: () => void
}

export default function JobApplicationModal({ job, onClose, onSuccess }: JobApplicationModalProps) {
    const { user } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [description, setDescription] = useState('')
    const [budgetSatisfied, setBudgetSatisfied] = useState(true)
    const [counterOffer, setCounterOffer] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Validation
        if (description.trim().length < 50) {
            setError('Please provide at least 50 characters explaining why you are suitable for this job')
            return
        }

        if (!budgetSatisfied) {
            const counterAmount = parseFloat(counterOffer)
            if (isNaN(counterAmount) || counterAmount <= 0) {
                setError('Please enter a valid counter offer amount')
                return
            }
        }

        if (!user) {
            setError('You must be logged in to apply')
            return
        }

        setSubmitting(true)

        try {
            await applyToJob(
                job.id,
                user.uid,
                description.trim(),
                budgetSatisfied,
                budgetSatisfied ? undefined : parseFloat(counterOffer)
            )
            onSuccess()
            onClose()
        } catch (err: any) {
            setError(err.message || 'Failed to submit application')
        } finally {
            setSubmitting(false)
        }
    }

    if (!mounted) return null

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-8">
            <div
                className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
                style={{
                    backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
                    boxShadow: isDark
                        ? '0 25px 50px -12px rgba(255, 255, 255, 0.2)'
                        : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }}
            >
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: isDark ? '#2a2a2a' : '#e5e7eb' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                Apply for Job
                            </h2>
                            <p className="text-sm mt-1 line-clamp-1" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                                {job.caption}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X className="w-6 h-6" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} />
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Budget Display */}
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border-2 border-green-500/50">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Offered Budget
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ₹{job.budget.toLocaleString()}
                        </p>
                    </div>

                    {/* Description Field */}
                    <div>
                        <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            Why are you suitable for this job? *
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe your skills, experience, and why you're the best fit for this job..."
                            rows={5}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                            required
                        />
                        <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                            {description.length}/50 characters minimum
                        </p>
                    </div>

                    {/* Budget Satisfaction */}
                    <div className="space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={budgetSatisfied}
                                onChange={(e) => setBudgetSatisfied(e.target.checked)}
                                className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                I'm satisfied with the offered budget (₹{job.budget.toLocaleString()})
                            </span>
                        </label>

                        {/* Counter Offer (shown when not satisfied) */}
                        {!budgetSatisfied && (
                            <div className="ml-8 mt-3">
                                <label className="block text-sm font-semibold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                    Your Counter Offer (₹)
                                </label>
                                <input
                                    type="number"
                                    value={counterOffer}
                                    onChange={(e) => setCounterOffer(e.target.value)}
                                    placeholder="Enter your proposed amount"
                                    min="1"
                                    className="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    required={!budgetSatisfied}
                                />
                                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                                    Enter the amount you would like to be paid for this job
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                </form>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
