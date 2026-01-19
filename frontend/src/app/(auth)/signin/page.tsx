'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, Phone, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, X } from 'lucide-react'
import {
  signInWithEmail,
  sendOTP,
  verifyOTPSignIn,
  getUserVerificationStatus,
  clearRecaptcha,
  resetPassword,
  checkPhoneNumberExists,
  getUserByPhoneNumber,
  checkOnboardingStatus
} from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'
import { ConfirmationResult } from 'firebase/auth'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'

type AuthMethod = 'email' | 'phone'
type PhoneStep = 'number' | 'otp'

export default function SignInPage() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('number')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  // Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState(false)

  // Rate limiting states
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0)

  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)

    // Load rate limiting data from localStorage
    const storedAttempts = localStorage.getItem('signin_failed_attempts')
    const storedLockout = localStorage.getItem('signin_lockout_until')

    if (storedAttempts) {
      setFailedAttempts(parseInt(storedAttempts))
    }

    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout)
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime)
      } else {
        // Lockout expired, clear it
        localStorage.removeItem('signin_lockout_until')
        localStorage.removeItem('signin_failed_attempts')
      }
    }

    // Cleanup on unmount
    return () => {
      clearRecaptcha()
    }
  }, [])

  useEffect(() => {
    if (authMethod === 'phone') {
      clearRecaptcha()
    }
  }, [authMethod])

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutUntil) {
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000))
        setLockoutTimeRemaining(remaining)

        if (remaining === 0) {
          // Lockout expired
          setLockoutUntil(null)
          setFailedAttempts(0)
          localStorage.removeItem('signin_lockout_until')
          localStorage.removeItem('signin_failed_attempts')
          setError('')
        }
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [lockoutUntil])

  // Check if user is already logged in with complete profile
  useEffect(() => {
    if (user && !authLoading) {
      const checkProfileAndRedirect = async () => {
        const status = await getUserVerificationStatus(user.uid)

        // Only redirect if profile is complete
        if (status?.profileComplete && status?.emailVerified && status?.phoneVerified) {
          console.log('✅ Profile complete, redirecting to dashboard')
          router.replace('/dashboard')
        } else {
          console.log('⚠️ Profile incomplete, staying on signin page')
        }
      }

      checkProfileAndRedirect()
    }
  }, [user, authLoading, router])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Check if user is locked out
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const minutes = Math.floor(lockoutTimeRemaining / 60)
      const seconds = lockoutTimeRemaining % 60
      setError(
        `🔒 Too many failed sign-in attempts.\n\n` +
        `⏱️ Try again in ${minutes}:${seconds.toString().padStart(2, '0')}\n\n` +
        `💡 Forgot your password? Click "Forgot Password" below to reset it.`
      )
      return
    }

    setLoading(true)

    try {
      // Step 1: Sign in with email
      const user = await signInWithEmail(email, password)

      console.log('👤 User signed in:', user.uid)
      console.log('📧 Email verified:', user.emailVerified)
      console.log('📱 Phone number:', user.phoneNumber)

      // Step 2: Check email verification
      if (!user.emailVerified) {
        console.log('⚠️ Email not verified, attempting to send verification email...')

        // Automatically send verification email
        try {
          const { resendVerificationEmail } = await import('@/lib/auth')
          await resendVerificationEmail(email, password)

          console.log('✅ Verification email sent successfully!')
          setSuccess('📧 Verification email sent! Please check your inbox and verify your email before signing in.\n\n⏱️ Email may take up to 2 minutes to arrive. Check your spam folder if you don\'t see it.\n\nOnce verified, come back and sign in again.')
        } catch (emailErr: any) {
          console.error('❌ Failed to send verification email:', emailErr)
          console.error('Error message:', emailErr.message)

          // If sending fails (e.g., rate limit), show helpful message
          if (emailErr.message && emailErr.message.includes('Too many requests')) {
            console.log('⏱️ Rate limited - too many verification emails sent recently')
            setError('⚠️ Email not verified yet.\n\n🔄 A verification email was sent recently (within the last few minutes).\n\n📧 Please check your inbox and spam folder for the verification link.\n\n⏱️ If you need another email, please wait a few minutes and try again.')
          } else {
            console.log('⚠️ Could not send verification email, but one may have been sent earlier')
            setError('⚠️ Email not verified yet.\n\nPlease check your inbox (and spam folder) for the verification link.\n\nIf you don\'t see it, wait a few minutes and try signing in again.')
          }
        }

        setLoading(false)
        return
      }

      // Step 3: Get verification status from Firestore
      const verificationStatus = await getUserVerificationStatus(user.uid)

      console.log('🔍 Verification status:', verificationStatus)

      // Step 4: Check phone verification
      const hasPhoneNumber = user.phoneNumber || verificationStatus?.phoneVerified

      if (!hasPhoneNumber) {
        setError('⚠️ Phone verification pending. Redirecting to complete setup...')

        // Redirect to signup page with phone step
        setTimeout(() => {
          router.push('/signup?step=phone')
        }, 1500)

        setLoading(false)
        return
      }

      // Step 5: Check onboarding status
      const onboardingStatus = await checkOnboardingStatus(user.uid)
      console.log('🔍 Onboarding status:', onboardingStatus)

      if (!onboardingStatus?.onboardingComplete) {
        console.log('⚠️ Onboarding incomplete, redirecting...')

        // Redirect to appropriate onboarding step
        if (!onboardingStatus?.education || !onboardingStatus?.employment) {
          setError('⚠️ Please complete your profile. Redirecting...')
          setTimeout(() => {
            router.push('/onboarding/education')
          }, 1500)
        } else if (!onboardingStatus?.location || !onboardingStatus?.address) {
          setError('⚠️ Please add your location. Redirecting...')
          setTimeout(() => {
            router.push('/onboarding/location')
          }, 1500)
        }

        setLoading(false)
        return
      }

      // Step 6: All verified and onboarded - proceed to dashboard
      console.log('✅ Authentication complete! Redirecting to dashboard...')

      // Clear rate limiting on successful sign-in
      setFailedAttempts(0)
      setLockoutUntil(null)
      localStorage.removeItem('signin_failed_attempts')
      localStorage.removeItem('signin_lockout_until')

      router.replace('/dashboard')

    } catch (err: any) {
      console.error('❌ Sign in error:', err)

      // Increment failed attempts
      const newAttempts = failedAttempts + 1
      setFailedAttempts(newAttempts)
      localStorage.setItem('signin_failed_attempts', newAttempts.toString())

      // Check if we should lock out
      if (newAttempts >= 5) {
        const lockoutTime = Date.now() + (5 * 60 * 1000) // 5 minutes
        setLockoutUntil(lockoutTime)
        localStorage.setItem('signin_lockout_until', lockoutTime.toString())
        setError(
          `🔒 Too many failed sign-in attempts.\n\n` +
          `⏱️ Your account is locked for 5 minutes.\n\n` +
          `💡 Forgot your password? Click "Forgot Password" below to reset it and unlock your account.`
        )
      } else {
        setError(`❌ ${err.message || 'Failed to sign in'}\n\n⚠️ ${5 - newAttempts} attempts remaining before lockout.`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`

      // Check if phone number exists in database
      console.log('🔍 Checking if phone number exists:', formattedPhone)
      const phoneExists = await checkPhoneNumberExists(formattedPhone)

      if (!phoneExists) {
        setError('❌ No account found with this phone number.\n\nPlease sign up first or sign in with email if you already have an account.')
        setLoading(false)
        return
      }

      console.log('✅ Phone number exists, sending OTP...')

      // Clear any existing recaptcha before starting
      clearRecaptcha()

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300))

      const result = await sendOTP(formattedPhone)
      setConfirmationResult(result)
      setSuccess('✅ OTP sent successfully!')
      setPhoneStep('otp')
    } catch (err: any) {
      setError('❌ ' + (err.message || 'Failed to send OTP'))
      clearRecaptcha()
    } finally {
      setLoading(false)
    }
  }

  // ✅ UPDATED: Phone login with linked credentials
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!confirmationResult) throw new Error('Please request OTP first')

      // Verify OTP - Firebase returns the same user whether signing in with email or phone (if linked)
      const phoneUser = await verifyOTPSignIn(confirmationResult, otp)

      console.log('✅ Phone OTP verified, user:', phoneUser.uid)
      console.log('📱 Phone number:', phoneUser.phoneNumber)

      // Get user verification status
      const verificationStatus = await getUserVerificationStatus(phoneUser.uid)
      console.log('🔍 Verification status:', verificationStatus)

      // Check if email is verified
      if (!verificationStatus?.emailVerified) {
        setError('⚠️ Please verify your email before signing in.\n\nSign in with email to complete verification.')
        setLoading(false)
        return
      }

      // Check if profile is complete
      if (!verificationStatus?.profileComplete) {
        setError('⚠️ Profile incomplete. Please complete signup with email first.')
        setLoading(false)
        return
      }

      // Check onboarding status
      const onboardingStatus = await checkOnboardingStatus(phoneUser.uid)
      console.log('🔍 Onboarding status:', onboardingStatus)

      if (!onboardingStatus?.onboardingComplete) {
        console.log('⚠️ Onboarding incomplete, redirecting...')

        // Redirect to appropriate onboarding step
        if (!onboardingStatus?.education || !onboardingStatus?.employment) {
          setError('⚠️ Please complete your profile. Redirecting...')
          setTimeout(() => {
            router.push('/onboarding/education')
          }, 1500)
        } else if (!onboardingStatus?.location || !onboardingStatus?.address) {
          setError('⚠️ Please add your location. Redirecting...')
          setTimeout(() => {
            router.push('/onboarding/location')
          }, 1500)
        }

        setLoading(false)
        return
      }

      // All verified and onboarded - redirect to dashboard
      console.log('✅ Phone login successful!')
      setSuccess('✅ Login successful! Redirecting...')

      setTimeout(() => {
        router.replace('/dashboard')
      }, 1000)

    } catch (err: any) {
      setError('❌ ' + (err.message || 'Invalid OTP'))
    } finally {
      setLoading(false)
    }
  }

  // Forgot Password Handler
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)

    try {
      await resetPassword(resetEmail)
      setResetSuccess(true)

      // Clear rate limiting when password reset is sent
      setFailedAttempts(0)
      setLockoutUntil(null)
      localStorage.removeItem('signin_failed_attempts')
      localStorage.removeItem('signin_lockout_until')
      setError('') // Clear any lockout error message
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email')
    } finally {
      setResetLoading(false)
    }
  }

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
        }}
      >
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <>
      <ThemeToggle />
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-12"
        style={{
          background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
        }}
      >
        <div id="recaptcha-container"></div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p
              className="mt-2"
              style={{
                color: mounted && theme === 'dark' ? '#ffffff' : 'rgb(75, 85, 99)'
              }}
            >
              Sign in to continue to NeedYou
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">

            {/* Important Notice */}
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> You can only sign in if both your email and phone number are verified.
                </span>
              </p>
            </div>

            {/* Auth Method Toggle */}
            <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-700 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('email')
                  setPhoneStep('number')
                  setError('')
                  setSuccess('')
                  clearRecaptcha()
                }}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${authMethod === 'email'
                  ? 'bg-white dark:bg-[#1c1c1c] text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}
              >
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMethod('phone')
                  setPhoneStep('number')
                  setError('')
                  setSuccess('')
                  clearRecaptcha()
                }}
                className={`py-2 px-4 rounded-lg font-medium transition-all ${authMethod === 'phone'
                  ? 'bg-white dark:bg-[#1c1c1c] text-blue-600 dark:text-blue-400 shadow-md'
                  : 'text-gray-600 dark:text-gray-400'
                  }`}
              >
                <Phone className="w-4 h-4 inline mr-2" />
                Phone
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {/* Email Form */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

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
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                      placeholder="••••••••"
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

                {/* Forgot Password Link */}
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true)
                      setResetEmail(email)
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
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
                </button>
              </form>
            )}

            {/* Phone Form - Enter Number */}
            {authMethod === 'phone' && phoneStep === 'number' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <div className="absolute left-10 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                      +91
                    </div>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-20 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneNumber.length !== 10}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send OTP
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Phone Form - Verify OTP */}
            {authMethod === 'phone' && phoneStep === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
                    OTP sent to +91{phoneNumber}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify & Sign In
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPhoneStep('number')
                    setOtp('')
                    setConfirmationResult(null)
                    setPhoneNumber('')
                    setError('')
                    setSuccess('')
                    clearRecaptcha()
                  }}
                  className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Change Number / Resend OTP
                </button>
              </form>
            )}

            {/* Sign Up Link */}
            <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link href="/signup" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Forgot Password Modal */}
        {showForgotPassword && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-[#1c1c1c] rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              {!resetSuccess ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Reset Password
                    </h2>
                    <button
                      onClick={() => {
                        setShowForgotPassword(false)
                        setResetError('')
                        setResetSuccess(false)
                        setResetEmail('')
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Enter your email address and we'll send you a link to reset your password.
                  </p>

                  {resetError && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                      {resetError}
                    </div>
                  )}

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {resetLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Reset Link
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    We've sent a password reset link to:
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 font-semibold mb-4">
                    {resetEmail}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    Click the link in the email to reset your password. The link will expire in 1 hour.
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Email may take up to 2 minutes to arrive. Check your spam folder.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false)
                      setResetSuccess(false)
                      setResetEmail('')
                    }}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </>
  )
}
