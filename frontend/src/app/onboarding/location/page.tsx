'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { MapPin, Navigation, Home, Building2, ArrowRight, Loader2, AlertCircle, Check, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
    updateUserLocation,
    updateUserAddress,
    completeOnboarding,
    checkOnboardingStatus
} from '@/lib/auth'
import { detectUserLocation, reverseGeocode, type LocationData } from '@/lib/location'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import ThemeToggle from '@/components/ThemeToggle'

type AddressType = 'home' | 'office' | 'other'

function LocationContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user, loading: authLoading } = useAuth()
    const mapRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const isFirstIdle = useRef(true)
    const [map, setMap] = useState<google.maps.Map | null>(null)
    const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const [detecting, setDetecting] = useState(false)
    const [location, setLocation] = useState<LocationData | null>(null)
    const [updatingLocation, setUpdatingLocation] = useState(false)

    // Address fields
    const [addressType, setAddressType] = useState<AddressType>('home')
    const [addressLabel, setAddressLabel] = useState('')
    const [houseNumber, setHouseNumber] = useState('')
    const [detailedAddress, setDetailedAddress] = useState('')
    const [setAsDefault, setSetAsDefault] = useState(true)

    // Edit mode
    const [editMode, setEditMode] = useState(false)
    const [editAddressId, setEditAddressId] = useState<string | null>(null)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [mounted, setMounted] = useState(false)

    // Google Maps API key from environment
    const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

    useEffect(() => {
        setMounted(true)

        // Check if Google Maps is already loaded
        if (typeof window !== 'undefined' && (window as any).google?.maps) {
            setGoogleMapsLoaded(true)
        }

        // Check if we're in edit mode
        if (searchParams) {
            const editId = searchParams.get('edit')

            if (editId) {
                setEditMode(true)
                setEditAddressId(editId)

                // Pre-fill form with existing data
                const type = searchParams.get('type') as AddressType
                if (type) setAddressType(type)

                const label = searchParams.get('label')
                if (label) setAddressLabel(label)

                const house = searchParams.get('houseNumber')
                if (house) setHouseNumber(house)

                const detailed = searchParams.get('detailedAddress')
                if (detailed) setDetailedAddress(detailed)

                const isDefault = searchParams.get('isDefault')
                if (isDefault) setSetAsDefault(isDefault === 'true')

                // Set location from params
                const lat = searchParams.get('lat')
                const lng = searchParams.get('lng')
                const city = searchParams.get('city')
                const state = searchParams.get('state')
                const country = searchParams.get('country')
                const area = searchParams.get('area')

                if (lat && lng && city && state && country) {
                    setLocation({
                        latitude: parseFloat(lat),
                        longitude: parseFloat(lng),
                        city,
                        state,
                        country,
                        area: area || undefined
                    })
                }
            }
        }
    }, [searchParams])

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/signin')
        }
    }, [user, authLoading, router])

    // Check if education/employment is completed
    useEffect(() => {
        const checkStatus = async () => {
            if (user) {
                const status = await checkOnboardingStatus(user.uid)
                // Only redirect if education/employment is not completed
                // Allow users with completed onboarding to edit location
                if (!status?.education || !status?.employment) {
                    router.push('/onboarding/education')
                }
            }
        }
        checkStatus()
    }, [user, router])

    // Initialize Google Map when location is set
    useEffect(() => {
        if (googleMapsLoaded && location && mapRef.current && !map) {
            const newMap = new google.maps.Map(mapRef.current, {
                center: { lat: location.latitude, lng: location.longitude },
                zoom: 16,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                zoomControl: true,
            })

            // Listen to map movement with optimized debounce
            let timeoutId: NodeJS.Timeout
            newMap.addListener('idle', () => {
                if (isFirstIdle.current) {
                    isFirstIdle.current = false
                    return
                }
                clearTimeout(timeoutId)
                timeoutId = setTimeout(() => {
                    updateLocationFromMapCenter(newMap)
                }, 800)
            })

            setMap(newMap)

            // Initialize Google Places Autocomplete
            if (searchInputRef.current) {
                const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
                    fields: ['geometry', 'formatted_address', 'address_components'],
                })

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace()
                    if (place.geometry && place.geometry.location) {
                        const lat = place.geometry.location.lat()
                        const lng = place.geometry.location.lng()

                        // Move map to selected location
                        newMap.setCenter({ lat, lng })
                        newMap.setZoom(16)

                        // Update location data
                        updateLocationFromMapCenter(newMap)
                    }
                })
            }
        }
    }, [googleMapsLoaded, location, map])

    const updateLocationFromMapCenter = useCallback(async (currentMap: google.maps.Map) => {
        if (!currentMap || !GOOGLE_MAPS_API_KEY) return

        const center = currentMap.getCenter()
        if (!center) return

        setUpdatingLocation(true)
        try {
            const newLocation = await reverseGeocode(
                center.lat(),
                center.lng(),
                GOOGLE_MAPS_API_KEY
            )
            setLocation(newLocation)

            // Auto-fill address field with area if available
            const addressParts = [
                newLocation.area,
                newLocation.city,
                newLocation.state,
                newLocation.country
            ].filter(Boolean)
            setDetailedAddress(addressParts.join(', '))
        } catch (err) {
            console.error('Failed to update location:', err)
        } finally {
            setUpdatingLocation(false)
        }
    }, [GOOGLE_MAPS_API_KEY])

    const handleAutoDetect = async () => {
        setError('')
        setDetecting(true)

        try {
            if (!GOOGLE_MAPS_API_KEY) {
                throw new Error('Google Maps API key not configured. Please contact support.')
            }

            const position = await detectUserLocation()
            const { latitude, longitude } = position.coords

            const locationData = await reverseGeocode(latitude, longitude, GOOGLE_MAPS_API_KEY)

            setLocation(locationData)
            // Auto-fill with area if available
            const addressParts = [
                locationData.area,
                locationData.city,
                locationData.state,
                locationData.country
            ].filter(Boolean)
            setDetailedAddress(addressParts.join(', '))
            console.log('✅ Location detected:', locationData)

        } catch (err: any) {
            console.error('❌ Auto-detect error:', err)
            setError(err.message || 'Failed to detect location')
        } finally {
            setDetecting(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (!user) throw new Error('Not authenticated')
            if (!location) throw new Error('Please detect your location first')
            if (!houseNumber.trim()) throw new Error('Please enter your house/flat number')
            if (!detailedAddress.trim()) throw new Error('Please enter your detailed address')

            if (editMode && editAddressId) {
                // Edit existing address
                const { updateAddress, completeOnboarding } = await import('@/lib/auth')

                await updateAddress(user.uid, editAddressId, {
                    type: addressType,
                    label: addressLabel.trim(),
                    houseNumber: houseNumber.trim(),
                    detailedAddress: detailedAddress.trim(),
                    location: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        city: location.city,
                        state: location.state,
                        country: location.country,
                        area: location.area
                    },
                    isDefault: setAsDefault
                })

                console.log('✅ Address updated! Redirecting to dashboard...')
            } else {
                // Add new address
                const { addUserAddress, completeOnboarding } = await import('@/lib/auth')

                await addUserAddress(user.uid, {
                    type: addressType,
                    label: addressLabel.trim(),
                    houseNumber: houseNumber.trim(),
                    detailedAddress: detailedAddress.trim(),
                    location: {
                        latitude: location.latitude,
                        longitude: location.longitude,
                        city: location.city,
                        state: location.state,
                        country: location.country,
                        area: location.area
                    },
                    isDefault: setAsDefault
                })

                // Complete onboarding if not already done
                await completeOnboarding(user.uid)

                console.log('✅ Address saved! Redirecting to dashboard...')
            }

            router.push('/dashboard')

        } catch (err: any) {
            console.error('❌ Save error:', err)
            setError(err.message || 'Failed to save address')
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

    return (
        <>
            {/* Load Google Maps Script */}
            {GOOGLE_MAPS_API_KEY && (
                <Script
                    src={`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`}
                    onLoad={() => setGoogleMapsLoaded(true)}
                    strategy="lazyOnload"
                />
            )}

            <div className="min-h-screen w-full flex items-center justify-center px-4 py-12"
                style={{
                    background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
                }}
            >
                {/* Theme Toggle - Fixed Position */}
                <div className="fixed top-4 right-4 z-50">
                    <ThemeToggle />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-3xl"
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
                            Your Location
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-300">
                            Help us connect you with nearby opportunities
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm">
                                <Check className="w-5 h-5" />
                            </div>
                            <div className="w-16 h-1 bg-blue-600"></div>
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</div>
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
                            {/* Location Detection Section */}
                            <div>
                                {!location ? (
                                    <div className="text-center py-8">
                                        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <MapPin className="w-10 h-10 text-blue-600" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                            Detect Your Location
                                        </h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                                            We'll show your location on a map. Move the map to select your exact address.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleAutoDetect}
                                            disabled={detecting}
                                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                        >
                                            {detecting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Detecting...
                                                </>
                                            ) : (
                                                <>
                                                    <Navigation className="w-5 h-5" />
                                                    Detect My Location
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Search Location Input */}
                                        <div className="relative">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                ref={searchInputRef}
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search for a location..."
                                                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                            />
                                        </div>

                                        {/* Map Container with Professional Fixed Center Pin */}
                                        <div className="relative">
                                            <div
                                                ref={mapRef}
                                                className="w-full h-80 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600"
                                                style={{
                                                    minHeight: '320px',
                                                    position: 'relative',
                                                    backgroundColor: '#e5e3df'
                                                }}
                                            />

                                            {/* Professional Pin Design */}
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none z-10">
                                                {/* Pin Shadow */}
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-8 h-2 bg-black/20 rounded-full blur-sm"></div>

                                                {/* Pin with Pulse Animation */}
                                                <div className="relative">
                                                    {/* Pulse Ring */}
                                                    <div className="absolute inset-0 -m-2 rounded-full bg-red-500/30 animate-ping"></div>

                                                    {/* Main Pin SVG */}
                                                    <svg width="40" height="50" viewBox="0 0 40 50" className="relative drop-shadow-lg">
                                                        {/* Pin Shape */}
                                                        <path
                                                            d="M20 0C11.716 0 5 6.716 5 15c0 8.284 15 35 15 35s15-26.716 15-35c0-8.284-6.716-15-15-15z"
                                                            fill="#EF4444"
                                                            stroke="#DC2626"
                                                            strokeWidth="1"
                                                        />
                                                        {/* Inner Circle */}
                                                        <circle cx="20" cy="15" r="6" fill="white" />
                                                    </svg>
                                                </div>
                                            </div>

                                            {/* Location Info Overlay */}
                                            <div className="absolute top-4 left-4 right-4 bg-white dark:bg-[#1c1c1c] px-4 py-3 rounded-lg shadow-lg">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                            📍 {location.area ? `${location.area}, ` : ''}{location.city}, {location.state}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            Search or move the map to select your exact location
                                                        </p>
                                                    </div>
                                                    {updatingLocation && (
                                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600 ml-2" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Address Section - Shows after location is set */}
                            {location && (
                                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                        <Home className="w-5 h-5 text-blue-600" />
                                        Your Address
                                    </h3>

                                    {/* Address Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Address Type *
                                        </label>
                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setAddressType('home')}
                                                className={`py-3 px-4 rounded-xl font-medium transition-all ${addressType === 'home'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                <Home className="w-4 h-4 inline mr-1" />
                                                Home
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAddressType('office')}
                                                className={`py-3 px-4 rounded-xl font-medium transition-all ${addressType === 'office'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                <Building2 className="w-4 h-4 inline mr-1" />
                                                Office
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAddressType('other')}
                                                className={`py-3 px-4 rounded-xl font-medium transition-all ${addressType === 'other'
                                                    ? 'bg-blue-600 text-white shadow-md'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                    }`}
                                            >
                                                <MapPin className="w-4 h-4 inline mr-1" />
                                                Other
                                            </button>
                                        </div>
                                    </div>

                                    {/* Address Label (Optional) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Label (Optional)
                                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                e.g., "Parents House", "Office HQ"
                                            </span>
                                        </label>
                                        <input
                                            type="text"
                                            value={addressLabel}
                                            onChange={(e) => setAddressLabel(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                            placeholder="Give this address a nickname"
                                        />
                                    </div>

                                    {/* Set as Default */}
                                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                        <input
                                            type="checkbox"
                                            id="setAsDefault"
                                            checked={setAsDefault}
                                            onChange={(e) => setSetAsDefault(e.target.checked)}
                                            className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <label htmlFor="setAsDefault" className="flex-1 text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                                            Set as default address
                                            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                This will be your primary location for job searches
                                            </span>
                                        </label>
                                    </div>

                                    {/* House/Flat Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            House/Flat Number *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={houseNumber}
                                            onChange={(e) => setHouseNumber(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white"
                                            placeholder="e.g., A-101, House No. 42"
                                        />
                                    </div>

                                    {/* Detailed Address - Auto-filled but editable */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Street, Area & Landmark *
                                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                (Auto-filled, you can edit)
                                            </span>
                                        </label>
                                        <textarea
                                            required
                                            rows={3}
                                            value={detailedAddress}
                                            onChange={(e) => setDetailedAddress(e.target.value)}
                                            className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white resize-none"
                                            placeholder="e.g., MG Road, Near City Mall, Andheri West, Mumbai - 400053"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            {location && houseNumber && detailedAddress && (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Saving Address...
                                        </>
                                    ) : (
                                        <>
                                            Save Address
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            )}
                        </form>
                    </div>
                </motion.div>
            </div>
        </>
    )
}

export default function LocationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen w-full flex items-center justify-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        }>
            <LocationContent />
        </Suspense>
    )
}
