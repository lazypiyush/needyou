// Location utility functions for Google Maps integration

export interface LocationData {
    latitude: number
    longitude: number
    city: string
    state: string
    country: string
    area?: string  // Area/sublocality/neighborhood
}

// Detect user's current location using browser geolocation
export const detectUserLocation = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by your browser'))
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Location detected:', position.coords)
                resolve(position)
            },
            (error) => {
                console.error('❌ Geolocation error:', error)

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        reject(new Error('Location permission denied. Please enable location access or enter manually.'))
                        break
                    case error.POSITION_UNAVAILABLE:
                        reject(new Error('Location information unavailable. Please enter manually.'))
                        break
                    case error.TIMEOUT:
                        reject(new Error('Location request timed out. Please try again or enter manually.'))
                        break
                    default:
                        reject(new Error('An unknown error occurred. Please enter location manually.'))
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        )
    })
}


// Reverse geocode coordinates to get address using Google Maps Geocoding API
export const reverseGeocode = async (
    lat: number,
    lng: number,
    apiKey: string
): Promise<LocationData> => {
    try {
        console.log('🗺️ Reverse geocoding:', lat, lng)

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch location data from Google Maps')
        }

        const data = await response.json()

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw new Error('No location data found for these coordinates')
        }

        // Extract city, state, country, area from address components
        const addressComponents = data.results[0].address_components

        let city = ''
        let state = ''
        let country = ''
        let area = ''

        for (const component of addressComponents) {
            // Area/Neighborhood/Sublocality
            if (component.types.includes('sublocality_level_1') || component.types.includes('sublocality')) {
                area = component.long_name
            } else if (component.types.includes('neighborhood') && !area) {
                area = component.long_name
            }
            // City
            else if (component.types.includes('locality')) {
                city = component.long_name
            } else if (component.types.includes('administrative_area_level_3') && !city) {
                city = component.long_name
            }
            // State
            else if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name
            }
            // Country
            else if (component.types.includes('country')) {
                country = component.long_name
            }
        }

        console.log('✅ Location found:', { area, city, state, country })

        return {
            latitude: lat,
            longitude: lng,
            area: area || undefined,
            city: city || 'Unknown',
            state: state || 'Unknown',
            country: country || 'Unknown'
        }
    } catch (error: any) {
        console.error('❌ Reverse Geocoding Error:', error)
        throw new Error(error.message || 'Failed to get location details')
    }
}


// Geocode address to get coordinates (optional, for manual entry validation)
export const geocodeAddress = async (
    address: string,
    apiKey: string
): Promise<{ lat: number; lng: number }> => {
    try {
        console.log('🗺️ Geocoding address:', address)

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
        )

        if (!response.ok) {
            throw new Error('Failed to fetch coordinates from Google Maps')
        }

        const data = await response.json()

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            throw new Error('Address not found')
        }

        const location = data.results[0].geometry.location

        console.log('✅ Coordinates found:', location)

        return {
            lat: location.lat,
            lng: location.lng
        }
    } catch (error: any) {
        console.error('❌ Geocoding Error:', error)
        throw new Error(error.message || 'Failed to geocode address')
    }
}
