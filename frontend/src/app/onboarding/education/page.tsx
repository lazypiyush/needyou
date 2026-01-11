'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { GraduationCap, Briefcase, Building2, Calendar, ArrowRight, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { updateUserEducation, updateUserEmployment, checkOnboardingStatus } from '@/lib/auth'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const educationLevels = [
    'High School (10th)',
    'Higher Secondary (11th-12th)',
    'Associate Degree',
    'Bachelor\'s Degree',
    'Master\'s Degree',
    'Doctoral Degree (PhD)',
    'Professional Degree',
    'Diploma/Certificate',
    'Other'
]

const employmentStatuses = [
    'Employed',
    'Self-Employed',
    'Freelancer',
    'Student',
    'Unemployed',
    'Retired'
]

export default function EducationPage() {
    const router = useRouter()
    const { user, loading: authLoading } = useAuth()

    // Education fields
    const [degree, setDegree] = useState('')
    const [fieldOfStudy, setFieldOfStudy] = useState('')
    const [institution, setInstitution] = useState('')
    const [graduationYear, setGraduationYear] = useState('')

    // Employment fields
    const [employmentStatus, setEmploymentStatus] = useState('')
    const [company, setCompany] = useState('')
    const [position, setPosition] = useState('')
    const [experienceYears, setExperienceYears] = useState('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/signin')
        }
    }, [user, authLoading, router])

    // Check if already completed
    useEffect(() => {
        const checkStatus = async () => {
            if (user) {
                const status = await checkOnboardingStatus(user.uid)
                if (status?.education && status?.employment) {
                    // Already completed, go to location
                    router.push('/onboarding/location')
                }
            }
        }
        checkStatus()
    }, [user, router])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (!user) throw new Error('Not authenticated')

            // Validate required fields
            if (!degree || !fieldOfStudy || !institution || !graduationYear) {
                throw new Error('Please fill in all education fields')
            }

            if (!employmentStatus) {
                throw new Error('Please select your employment status')
            }

            // Validate employment fields based on status
            const needsCompanyInfo = ['Employed', 'Self-Employed'].includes(employmentStatus)
            if (needsCompanyInfo && (!company || !position)) {
                throw new Error('Please fill in company and position details')
            }

            // Save education
            await updateUserEducation(user.uid, {
                degree,
                fieldOfStudy,
                institution,
                graduationYear: parseInt(graduationYear)
            })

            // Save employment
            await updateUserEmployment(user.uid, {
                status: employmentStatus,
                company: needsCompanyInfo ? company : null,
                position: needsCompanyInfo ? position : null,
                experienceYears: experienceYears ? parseInt(experienceYears) : null
            })

            console.log('✅ Education and employment saved, redirecting to location...')
            router.push('/onboarding/location')

        } catch (err: any) {
            console.error('❌ Save error:', err)
            setError(err.message || 'Failed to save information')
        } finally {
            setLoading(false)
        }
    }

    if (authLoading || !mounted) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        )
    }

    const needsCompanyInfo = ['Employed', 'Self-Employed'].includes(employmentStatus)
    const currentYear = new Date().getFullYear()

    return (
        <>
            <ThemeToggle />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
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
                        Complete Your Profile
                    </h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-300">
                        Tell us about your education and employment
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                        <div className="w-16 h-1 bg-gray-300 dark:bg-gray-600"></div>
                        <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center text-sm font-bold">2</div>
                    </div>
                </div>

                {/* Form Card */}
                <div className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">

                    {error && (
                        <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Education Section */}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <GraduationCap className="w-6 h-6 text-blue-600" />
                                Education
                            </h2>

                            <div className="space-y-4">
                                {/* Education Level */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Highest Education Level *
                                    </label>
                                    <select
                                        required
                                        value={degree}
                                        onChange={(e) => setDegree(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select education level</option>
                                        {educationLevels.map(level => (
                                            <option key={level} value={level}>{level}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Field of Study */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Field of Study *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={fieldOfStudy}
                                        onChange={(e) => setFieldOfStudy(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        placeholder="e.g., Computer Science, Business, Engineering"
                                    />
                                </div>

                                {/* Institution */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Institution Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={institution}
                                        onChange={(e) => setInstitution(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        placeholder="e.g., University of Mumbai"
                                    />
                                </div>

                                {/* Graduation Year */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Graduation Year *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1950"
                                        max={currentYear + 10}
                                        value={graduationYear}
                                        onChange={(e) => setGraduationYear(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        placeholder={currentYear.toString()}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Employment Section */}
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <Briefcase className="w-6 h-6 text-blue-600" />
                                Employment
                            </h2>

                            <div className="space-y-4">
                                {/* Employment Status */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Employment Status *
                                    </label>
                                    <select
                                        required
                                        value={employmentStatus}
                                        onChange={(e) => setEmploymentStatus(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                    >
                                        <option value="">Select employment status</option>
                                        {employmentStatuses.map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Company (conditional) */}
                                {needsCompanyInfo && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                <Building2 className="w-4 h-4 inline mr-1" />
                                                Company Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={company}
                                                onChange={(e) => setCompany(e.target.value)}
                                                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                                placeholder="e.g., Google, Freelance, Self"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Position/Role *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={position}
                                                onChange={(e) => setPosition(e.target.value)}
                                                className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                                placeholder="e.g., Software Engineer, Designer"
                                            />
                                        </div>
                                    </>
                                )}

                                {/* Years of Experience */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        <Calendar className="w-4 h-4 inline mr-1" />
                                        Years of Experience (optional)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="70"
                                        value={experienceYears}
                                        onChange={(e) => setExperienceYears(e.target.value)}
                                        className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    Continue to Location
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>
        </>
    )
}
