'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Loader2, MapPin, Search, Filter, Home, Plus, Bell, User, Briefcase, Edit, Trash2 } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { useTheme } from 'next-themes'

export default function DashboardPage() {
    const router = useRouter()
    const { user, loading } = useAuth()
    const { theme, systemTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [activeTab, setActiveTab] = useState('home')
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)
    const [hoveredTab, setHoveredTab] = useState<string | null>(null)
    const [userLocation, setUserLocation] = useState<{ city: string; state: string; country: string } | null>(null)
    const [showLocationModal, setShowLocationModal] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    // Fetch user location from database
    useEffect(() => {
        const fetchUserLocation = async () => {
            if (user) {
                try {
                    const { db } = await import('@/lib/firebase')
                    const { doc, getDoc } = await import('firebase/firestore')
                    const userDoc = await getDoc(doc(db, 'users', user.uid))

                    if (userDoc.exists()) {
                        const userData = userDoc.data()
                        if (userData.location) {
                            setUserLocation({
                                city: userData.location.city || '',
                                state: userData.location.state || '',
                                country: userData.location.country || ''
                            })
                        }
                    }
                } catch (error) {
                    console.error('Error fetching user location:', error)
                }
            }
        }

        fetchUserLocation()
    }, [user])

    // Fetch saved addresses
    const [savedAddresses, setSavedAddresses] = useState<any[]>([])
    const [loadingAddresses, setLoadingAddresses] = useState(false)

    const fetchSavedAddresses = async () => {
        if (!user) return

        setLoadingAddresses(true)
        try {
            const { getUserAddresses } = await import('@/lib/auth')
            const addresses = await getUserAddresses(user.uid)
            setSavedAddresses(addresses)
        } catch (error) {
            console.error('Error fetching addresses:', error)
        } finally {
            setLoadingAddresses(false)
        }
    }

    useEffect(() => {
        if (showLocationModal && user) {
            fetchSavedAddresses()
        }
    }, [showLocationModal, user])

    const handleSetDefaultAddress = async (addressId: string) => {
        if (!user) return

        try {
            const { setDefaultAddress } = await import('@/lib/auth')
            await setDefaultAddress(user.uid, addressId)

            // Refresh addresses and location
            await fetchSavedAddresses()

            // Update displayed location
            const defaultAddr = savedAddresses.find(addr => addr.id === addressId)
            if (defaultAddr) {
                setUserLocation({
                    city: defaultAddr.location.city,
                    state: defaultAddr.location.state,
                    country: defaultAddr.location.country
                })
            }
        } catch (error) {
            console.error('Error setting default address:', error)
        }
    }

    const handleDeleteAddress = async (addressId: string) => {
        if (!user) return

        // Confirm deletion
        if (!confirm('Are you sure you want to delete this address?')) return

        try {
            const { deleteAddress } = await import('@/lib/auth')
            await deleteAddress(user.uid, addressId)

            // Refresh addresses
            await fetchSavedAddresses()
        } catch (error) {
            console.error('Error deleting address:', error)
            alert('Failed to delete address. Please try again.')
        }
    }

    // Helper function to get navigation item color
    const getNavColor = (tabName: string) => {
        if (!mounted) return isDark ? '#ffffff' : '#374151'

        const isActive = activeTab === tabName
        const isHovered = hoveredTab === tabName

        if (isDark) {
            if (isActive) return '#1E5EFF' // Blue for active in dark mode
            if (isHovered) return '#000000' // Black for hover in dark mode
            return '#ffffff' // White for normal in dark mode
        } else {
            if (isActive) return '#1E5EFF' // Blue for active in light mode
            if (isHovered) return '#000000' // Black for hover in light mode
            return '#374151' // Dark gray for normal in light mode
        }
    }


    useEffect(() => {
        if (!loading && !user) {
            router.push('/signin')
        }
    }, [user, loading, router])

    if (loading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center transition-colors duration-300"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
                }}>
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
        )
    }

    return (
        <>
            <div className="min-h-screen w-full pb-20 md:pb-0 transition-colors duration-300"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
                }}>
                {/* Top Bar */}
                <div className="sticky top-0 z-40 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm"
                    style={{
                        backgroundColor: 'rgba(var(--gradient-from), 0.8)'
                    }}>
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <div className="flex items-center justify-between gap-4">

                            {/* Location - Top Left */}
                            <button
                                onClick={() => setShowLocationModal(true)}
                                className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
                            >
                                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <div className="hidden sm:block text-left">
                                    <p className="font-medium" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                        {userLocation?.city || 'Loading...'}
                                    </p>
                                    <p className="text-xs" style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                        {userLocation ? `${userLocation.state}, ${userLocation.country}` : 'Fetching location...'}
                                    </p>
                                </div>
                                <p className="sm:hidden font-medium" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                    {userLocation?.city || 'Loading...'}
                                </p>
                            </button>

                            {/* Search & Filter - Center/Right */}
                            <div className="flex-1 max-w-2xl flex items-center gap-2">
                                {/* Search Bar */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-300" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search for services, jobs, or people..."
                                        className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-full focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-300"
                                    />
                                </div>

                                {/* Filter Button */}
                                <button
                                    onClick={() => setShowFilters(!showFilters)}
                                    className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <Filter className="w-4 h-4 text-gray-600 dark:text-white" />
                                </button>
                            </div>

                            {/* Theme Toggle - Right */}
                            <ThemeToggle />
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="max-w-7xl mx-auto px-4 py-6 md:ml-64">
                    {activeTab === 'home' && (
                        <div>
                            <h1 className="text-2xl font-bold mb-4" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                Welcome back, {user?.displayName || 'User'}! 👋
                            </h1>
                            <p style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                Your dashboard content will go here
                            </p>
                        </div>
                    )}

                    {activeTab === 'jobs' && (
                        <div>
                            <h1 className="text-2xl font-bold mb-4" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                My Jobs
                            </h1>
                            <p style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                Your active and completed jobs will appear here
                            </p>
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div>
                            <h1 className="text-2xl font-bold mb-4" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                Create New Job
                            </h1>
                            <p style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                Job creation form will go here
                            </p>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div>
                            <h1 className="text-2xl font-bold mb-4" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                Notifications
                            </h1>
                            <p style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                Your notifications will appear here
                            </p>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div>
                            <h1 className="text-2xl font-bold mb-4" style={{ color: mounted && isDark ? '#ffffff' : '#111827' }}>
                                Profile
                            </h1>
                            <p style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                Your profile settings will go here
                            </p>
                        </div>
                    )}
                </div>

                {/* Bottom Navigation - Mobile Only */}
                <div className="fixed bottom-0 left-0 right-0 md:hidden backdrop-blur-md border-t border-gray-200 dark:border-gray-700 shadow-sm z-50"
                    style={{
                        backgroundColor: 'rgba(var(--gradient-from), 0.8)'
                    }}>
                    <div className="relative flex items-center justify-around px-2 py-2">
                        {/* Home */}
                        <button
                            onClick={() => setActiveTab('home')}
                            onMouseEnter={() => setHoveredTab('home')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all"
                            style={{ color: getNavColor('home') }}
                        >
                            <Home className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Home</span>
                        </button>

                        {/* Jobs */}
                        <button
                            onClick={() => setActiveTab('jobs')}
                            onMouseEnter={() => setHoveredTab('jobs')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all"
                            style={{ color: getNavColor('jobs') }}
                        >
                            <Briefcase className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Jobs</span>
                        </button>

                        {/* Create - Circular FAB */}
                        <button
                            onClick={() => setActiveTab('create')}
                            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all hover:scale-110"
                        >
                            <Plus className="w-7 h-7 text-white" strokeWidth={3} />
                        </button>

                        {/* Notifications */}
                        <button
                            onClick={() => setActiveTab('notifications')}
                            onMouseEnter={() => setHoveredTab('notifications')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all relative"
                            style={{ color: getNavColor('notifications') }}
                        >
                            <Bell className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Alerts</span>
                            {/* Notification Badge */}
                            <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>

                        {/* Profile */}
                        <button
                            onClick={() => setActiveTab('profile')}
                            onMouseEnter={() => setHoveredTab('profile')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all"
                            style={{ color: getNavColor('profile') }}
                        >
                            <User className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Profile</span>
                        </button>
                    </div>
                </div>

                {/* Desktop Sidebar Navigation */}
                <div className="hidden md:block fixed left-0 top-16 bottom-0 w-64 backdrop-blur-md border-r border-gray-200 dark:border-gray-700 p-4 shadow-sm"
                    style={{
                        backgroundColor: 'rgba(var(--gradient-from), 0.8)'
                    }}>
                    <nav className="space-y-2">
                        <button
                            onClick={() => setActiveTab('home')}
                            onMouseEnter={() => setHoveredTab('home')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'home'
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={{ color: getNavColor('home') }}
                        >
                            <Home className="w-5 h-5" />
                            <span className="font-medium">Home</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('jobs')}
                            onMouseEnter={() => setHoveredTab('jobs')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'jobs'
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={{ color: getNavColor('jobs') }}
                        >
                            <Briefcase className="w-5 h-5" />
                            <span className="font-medium">My Jobs</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('create')}
                            onMouseEnter={() => setHoveredTab('create')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'create'
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={{ color: getNavColor('create') }}
                        >
                            <Plus className="w-5 h-5" />
                            <span className="font-medium">Create Job</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('notifications')}
                            onMouseEnter={() => setHoveredTab('notifications')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all relative ${activeTab === 'notifications'
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={{ color: getNavColor('notifications') }}
                        >
                            <Bell className="w-5 h-5" />
                            <span className="font-medium">Notifications</span>
                            <span className="absolute right-4 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>

                        <button
                            onClick={() => setActiveTab('profile')}
                            onMouseEnter={() => setHoveredTab('profile')}
                            onMouseLeave={() => setHoveredTab(null)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'profile'
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={{ color: getNavColor('profile') }}
                        >
                            <User className="w-5 h-5" />
                            <span className="font-medium">Profile</span>
                        </button>
                    </nav>
                </div>
            </div>

            {/* Location Edit Modal */}
            {showLocationModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div
                        className="rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                        style={{
                            backgroundColor: mounted && isDark ? '#121212ff' : '#ffffff',
                            color: mounted && isDark ? '#ffffff' : '#111827'
                        }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Saved Addresses</h2>
                            <button
                                onClick={() => setShowLocationModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {loadingAddresses ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : savedAddresses.length === 0 ? (
                            <div className="text-center py-12">
                                <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                                <p className="text-gray-500 dark:text-gray-400 mb-6">No saved addresses yet</p>
                                <button
                                    onClick={() => {
                                        setShowLocationModal(false)
                                        router.push('/onboarding/location')
                                    }}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all"
                                >
                                    Add Your First Address
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* Saved Addresses List */}
                                <div className="space-y-3 mb-6">
                                    {savedAddresses.map((address) => (
                                        <div
                                            key={address.id}
                                            className="p-4 rounded-lg border-2 transition-all"
                                            style={{
                                                backgroundColor: mounted && isDark ? '#1a1a1a' : '#f9fafb',
                                                borderColor: address.isDefault ? '#1E5EFF' : (mounted && isDark ? '#2a2a2a' : '#e5e7eb')
                                            }}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div
                                                    className="flex items-start gap-3 flex-1 cursor-pointer"
                                                    onClick={() => !address.isDefault && handleSetDefaultAddress(address.id)}
                                                >
                                                    <MapPin className={`w-5 h-5 mt-1 ${address.isDefault ? 'text-blue-600' : 'text-gray-400'}`} />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-semibold text-lg capitalize">{address.type}</span>
                                                            {address.label && (
                                                                <span className="text-sm text-gray-500 dark:text-gray-400">({address.label})</span>
                                                            )}
                                                            {address.isDefault && (
                                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                                                                    DEFAULT
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-medium">{address.houseNumber}</p>
                                                        <p className="text-sm" style={{ color: mounted && isDark ? '#dbd7d7ff' : '#6b7280' }}>
                                                            {address.detailedAddress}
                                                        </p>
                                                        <p className="text-xs mt-1" style={{ color: mounted && isDark ? '#9ca3af' : '#9ca3af' }}>
                                                            {address.location.city}, {address.location.state}, {address.location.country}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2 ml-3">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            // Navigate to location page with address data
                                                            const params = new URLSearchParams({
                                                                edit: address.id,
                                                                type: address.type,
                                                                label: address.label || '',
                                                                houseNumber: address.houseNumber,
                                                                detailedAddress: address.detailedAddress,
                                                                lat: address.location.latitude.toString(),
                                                                lng: address.location.longitude.toString(),
                                                                city: address.location.city,
                                                                state: address.location.state,
                                                                country: address.location.country,
                                                                area: address.location.area || '',
                                                                isDefault: address.isDefault.toString()
                                                            })
                                                            setShowLocationModal(false)
                                                            router.push(`/onboarding/location?${params.toString()}`)
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                                        title="Edit address"
                                                    >
                                                        <Edit className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleDeleteAddress(address.id)
                                                        }}
                                                        className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                        title="Delete address"
                                                    >
                                                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                                    </button>
                                                </div>
                                            </div>
                                            {!address.isDefault && (
                                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 ml-8">
                                                    Click to set as default
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Add New Address Button */}
                                < button
                                    onClick={() => {
                                        setShowLocationModal(false)
                                        router.push('/onboarding/location')
                                    }}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus className="w-5 h-5" />
                                    Add New Address
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
