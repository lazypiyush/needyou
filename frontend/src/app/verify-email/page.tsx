'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { applyActionCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

function VerifyEmailContent() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        const verifyEmail = async () => {
            const oobCode = searchParams.get('oobCode')

            if (!oobCode) {
                setStatus('error')
                setMessage('Invalid verification link. Please request a new verification email.')
                return
            }

            try {
                await applyActionCode(auth, oobCode)
                setStatus('success')
                setMessage('Email verified successfully! Redirecting to sign in...')
                setTimeout(() => router.push('/signin'), 3000)
            } catch (error: any) {
                console.error('Verification error:', error)
                setStatus('error')

                if (error.code === 'auth/invalid-action-code') {
                    setMessage('This verification link has expired or has already been used. Please request a new one.')
                } else if (error.code === 'auth/expired-action-code') {
                    setMessage('This verification link has expired. Please request a new verification email.')
                } else {
                    setMessage('Failed to verify email. Please try again or contact support.')
                }
            }
        }

        verifyEmail()
    }, [searchParams, router])

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-4">
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <div className="text-center">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="w-16 h-16 mx-auto mb-4 text-blue-600 animate-spin" />
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifying your email...</h1>
                            <p className="text-gray-600 dark:text-gray-400">Please wait while we verify your email address.</p>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Email Verified! ✅</h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-4">{message}</p>
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Redirecting...</span>
                            </div>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
                            </div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verification Failed</h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>
                            <button
                                onClick={() => router.push('/signup')}
                                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                Go to Sign Up
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen w-full flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    )
}
