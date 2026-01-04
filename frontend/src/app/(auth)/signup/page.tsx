'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Mail, Lock, User, Phone, ArrowRight, Loader2, CheckCircle, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react'
import {
  signUpWithEmail,
  sendOTP,
  verifyOTPSignIn,
  addPhoneToUser,
  checkEmailVerification,
  resendVerificationEmail,
  clearRecaptcha,
  onAuthStateChange,
  getUserVerificationStatus,
  signOutUser,
  checkPhoneNumberExists
} from '@/lib/auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { ConfirmationResult } from 'firebase/auth'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'

type SignUpStep = 'email' | 'verify-email' | 'phone' | 'verify-phone'

function SignUpPageContent() {
  const [step, setStep] = useState<SignUpStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mounted, setMounted] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [tempUserId, setTempUserId] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()

  useEffect(() => {
    setMounted(true)

    // Check URL parameters for redirects from signin
    const stepParam = searchParams.get('step')

    // Check if user is already authenticated and resume process
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        console.log('👤 User found:', user.email)

        // Get user verification status
        const status = await getUserVerificationStatus(user.uid)

        if (status) {
          setTempUserId(user.uid)
          setEmail(user.email || '')
          setName(user.displayName || '')

          // Check if redirected from signin with specific step
          if (stepParam === 'phone' && !status.phoneVerified) {
            console.log('📱 Redirected from signin - Resuming phone verification')
            setSuccess('✅ Email verified! Please complete phone verification.')
            setStep('phone')
            setLoading(false)
            return
          }

          // Resume from where user left off
          if (status.profileComplete) {
            // Both email and phone verified - redirect to dashboard
            console.log('✅ Profile complete, redirecting to dashboard')
            router.push('/dashboard')
          } else if (status.emailVerified && !status.phoneVerified) {
            // Email verified but phone not - go to phone step
            console.log('📱 Resuming phone verification')
            setStep('phone')
            setLoading(false)
          } else if (!status.emailVerified) {
            // Email not verified - go to verification step
            console.log('📧 Resuming email verification')
            setStep('verify-email')
            setLoading(false)
          }
        } else {
          setLoading(false)
        }
      } else {
        // No user - check if coming from signin redirect
        if (stepParam === 'phone') {
          console.log('⚠️ Redirected to phone step but no user logged in')
          setError('Please sign in first to complete phone verification.')
          setTimeout(() => {
            router.push('/signin')
          }, 2000)
        }
        setLoading(false)
      }
    })

    // Cleanup on unmount
    return () => {
      unsubscribe()
      clearRecaptcha()
    }
  }, [router, searchParams])

  // Clear recaptcha when going back to phone step
  useEffect(() => {
    if (step === 'phone') {
      clearRecaptcha()
    }
  }, [step])

  // Handle resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  // Step 1: Create email account
  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const newUser = await signUpWithEmail(email, password, name)
      setTempUserId(newUser.uid)

      // Keep user signed in for email verification (don't sign out)
      // This allows resend email to work properly

      setSuccess('✅ Account created! Verification email sent.')
      setStep('verify-email')
    } catch (err: any) {
      // Check if email already exists
      if (err.message && err.message.includes('already registered')) {
        // Try to sign in and check verification status
        try {
          console.log('📧 Email exists, checking verification status...')
          const { signInWithEmail } = await import('@/lib/auth')
          const existingUser = await signInWithEmail(email, password)

          setTempUserId(existingUser.uid)

          if (!existingUser.emailVerified) {
            // Email exists but not verified - help them verify
            setSuccess('📧 Account found! We\'ve sent a new verification email. Please check your inbox.')
            setStep('verify-email')

            // Send a new verification email
            try {
              await resendVerificationEmail(email, password)
              setResendCooldown(60) // Set cooldown
            } catch (resendErr) {
              console.log('Note: Verification email may have been sent recently')
            }
          } else {
            // Email verified - redirect to phone or dashboard
            const { getUserVerificationStatus } = await import('@/lib/auth')
            const status = await getUserVerificationStatus(existingUser.uid)

            if (status?.phoneVerified) {
              setError('✅ This account is already complete! Redirecting to sign in...')
              setTimeout(() => router.push('/signin'), 2000)
            } else {
              setSuccess('✅ Email verified! Please complete phone verification.')
              setStep('phone')
            }
          }
        } catch (signInErr: any) {
          // Wrong password or other sign-in error
          if (signInErr.message && signInErr.message.includes('password')) {
            setError('❌ This email is already registered with a different password.\n\nPlease sign in instead or use "Forgot Password" if you don\'t remember it.')
          } else {
            setError(signInErr.message || 'This email is already registered. Please sign in instead.')
          }
        }
      } else {
        setError(err.message || 'Failed to create account')
      }
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Check if email is actually verified
  const handleEmailVerified = async () => {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const result = await checkEmailVerification(email, password)

      if (result.verified) {
        setTempUserId(result.userId)
        setSuccess('✅ Email verified successfully!')

        // User is now signed in, proceed to phone step
        setTimeout(() => {
          setStep('phone')
        }, 1000)
      } else {
        setError('⚠️ Email not verified yet. Please check your inbox and click the verification link.')
      }
    } catch (err: any) {
      setError('Please check your email and verify before continuing.')
    } finally {
      setLoading(false)
    }
  }

  // Resend verification email
  const handleResendEmail = async () => {
    // Check cooldown
    if (resendCooldown > 0) {
      setError(`⏱️ Please wait ${resendCooldown} seconds before requesting another email.`)
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await resendVerificationEmail(email, password)
      setSuccess('✅ Verification email sent again! Check your inbox.')
      // Set 60-second cooldown
      setResendCooldown(60)
    } catch (err: any) {
      setError(err.message || 'Failed to resend email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Send OTP to phone - INVISIBLE reCAPTCHA
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`

      // Check if phone number already exists (excluding current user)
      console.log('🔍 Checking if phone number already exists:', formattedPhone)
      console.log('👤 Current user ID:', tempUserId)
      const phoneExists = await checkPhoneNumberExists(formattedPhone, tempUserId)

      if (phoneExists) {
        setError('❌ This phone number is already registered with another account.\n\nPlease use a different phone number or sign in with your existing account.')
        setLoading(false)
        return
      }

      console.log('✅ Phone number is unique, proceeding...')

      // Clear any existing recaptcha before starting
      clearRecaptcha()

      // Small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 300))

      console.log('🚀 Sending OTP with invisible reCAPTCHA...')
      const result = await sendOTP(formattedPhone)
      setConfirmationResult(result)
      setSuccess('✅ OTP sent to your mobile! Check your SMS.')
      setStep('verify-phone')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP')
      clearRecaptcha()
    } finally {
      setLoading(false)
    }
  }

  // Step 4: Verify phone OTP and complete signup
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!confirmationResult) throw new Error('Please request OTP first')

      // Verify OTP
      await verifyOTPSignIn(confirmationResult, otp)

      // Add phone to user document
      const formattedPhone = phoneNumber.startsWith('+91') ? phoneNumber : `+91${phoneNumber}`
      await addPhoneToUser(tempUserId, formattedPhone)

      console.log('✅ Phone verified and added to profile')

      // Sign out user after complete signup
      await signOutUser()

      setSuccess('🎉 Sign up complete! Redirecting to sign in...')

      // Redirect to sign in page
      setTimeout(() => {
        router.push('/signin')
      }, 2000)

    } catch (err: any) {
      setError(err.message || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth state
  if (loading && !mounted) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
        }}
      >
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
      }}
    >
      {/* Hidden reCAPTCHA container - invisible mode */}
      <div id="recaptcha-container" className="hidden"></div>

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
            Create Account
          </h1>
          <p
            className="mt-2"
            style={{
              color: mounted && theme === 'dark' ? '#ffffff' : 'rgb(75, 85, 99)'
            }}
          >
            {step === 'email' && 'Step 1: Enter your details'}
            {step === 'verify-email' && 'Step 2: Verify your email'}
            {step === 'phone' && 'Step 3: Add phone number'}
            {step === 'verify-phone' && 'Step 4: Verify phone number'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-between mb-8 px-4">
          {['1', '2', '3', '4'].map((num, index) => {
            const steps: SignUpStep[] = ['email', 'verify-email', 'phone', 'verify-phone']
            const currentIndex = steps.indexOf(step)
            const isActive = index <= currentIndex

            return (
              <div key={num} className={`flex flex-col items-center ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}>
                  {num}
                </div>
                <span className="text-xs mt-1">
                  {index === 0 && 'Email'}
                  {index === 1 && 'Verify'}
                  {index === 2 && 'Phone'}
                  {index === 3 && 'Done'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Form Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm flex items-start gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Step 1: Email Signup */}
          {step === 'email' && (
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

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
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 2: Email Verification Notice */}
          {step === 'verify-email' && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Check Your Email
              </h3>
              <div className="text-gray-600 dark:text-gray-400 space-y-2">
                <p>
                  We've sent a verification link to <strong className="text-blue-600 dark:text-blue-400">{email}</strong>
                </p>
                <p className="text-sm">
                  Click the link in the email to verify your address, then click the button below.
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Can't find it? Check your spam/junk folder
                </p>
              </div>

              <button
                onClick={handleEmailVerified}
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    I've Verified My Email
                  </>
                )}
              </button>

              <button
                onClick={handleResendEmail}
                disabled={loading || resendCooldown > 0}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend Verification Email'}
              </button>

              <button
                onClick={() => {
                  setStep('email')
                  setError('')
                  setSuccess('')
                }}
                disabled={loading}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:underline"
              >
                Change Email Address
              </button>
            </div>
          )}

          {/* Step 3: Phone Number - INVISIBLE reCAPTCHA */}
          {step === 'phone' && (
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
                    Send OTP via SMS
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 4: Verify Phone OTP */}
          {step === 'verify-phone' && (
            <form onSubmit={handleVerifyPhone} className="space-y-4">
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
                  📱 OTP sent to +91{phoneNumber} via SMS
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
                    Complete Sign Up
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('phone')
                  setOtp('')
                  setConfirmationResult(null)
                  setPhoneNumber('')
                  clearRecaptcha()
                }}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Change Number / Resend OTP
              </button>
            </form>
          )}

          {/* Sign In Link */}
          <p className="text-center mt-6 text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <Link href="/signin" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

// Wrap in Suspense to handle useSearchParams during SSR
export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center"
        style={{
          background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
        }}
      >
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    }>
      <SignUpPageContent />
    </Suspense>
  )
}
