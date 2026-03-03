'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, RefreshCw } from 'lucide-react'

interface LiveTrackingMapProps {
    workerLat: number | null
    workerLng: number | null
    locationUpdatedAt?: number | null
    /** Destination = job location (client's address). Pass to draw the route. */
    destinationLat?: number | null
    destinationLng?: number | null
    /** 'worker' = blue person icon; 'client' = red person icon */
    role: 'worker' | 'client'
    height?: number
    isDark?: boolean
}

let scriptPromise: Promise<void> | null = null

function loadGoogleMaps(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve()
    if ((window as any).google?.maps) return Promise.resolve()
    if (scriptPromise) return scriptPromise

    scriptPromise = new Promise<void>((resolve, reject) => {
        const existing = document.getElementById('gmap-script')
        if (existing) { existing.addEventListener('load', () => resolve()); return }

        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
        const s = document.createElement('script')
        s.id = 'gmap-script'
        s.src = `https://maps.googleapis.com/maps/api/js?key=${key}`
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => { scriptPromise = null; reject(new Error('Google Maps failed to load')) }
        document.head.appendChild(s)
    })
    return scriptPromise
}

/** SVG pin with a person silhouette inside — colour controlled by caller */
function buildPersonIcon(gm: any, fillColor: string) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <path d="M19 0C8.51 0 0 8.51 0 19c0 13.25 19 29 19 29S38 32.25 38 19C38 8.51 29.49 0 19 0z" fill="${fillColor}"/>
      <circle cx="19" cy="13" r="5.5" fill="white"/>
      <path d="M9.5 33c0-5.25 4.25-9.5 9.5-9.5s9.5 4.25 9.5 9.5" stroke="white" stroke-width="2" fill="white" fill-opacity="0.9"/>
    </svg>`
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new gm.Size(38, 48),
        anchor: new gm.Point(19, 48),
    }
}

/** Green house-pin for the destination / job location */
function buildDestinationIcon(gm: any) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="48" viewBox="0 0 38 48">
      <path d="M19 0C8.51 0 0 8.51 0 19c0 13.25 19 29 19 29S38 32.25 38 19C38 8.51 29.49 0 19 0z" fill="#10b981"/>
      <path d="M19 9 L28 17 H25 V27 H22 V21 H16 V27 H13 V17 H10 Z" fill="white"/>
    </svg>`
    return {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new gm.Size(38, 48),
        anchor: new gm.Point(19, 48),
    }
}

export default function LiveTrackingMap({
    workerLat,
    workerLng,
    locationUpdatedAt,
    destinationLat,
    destinationLng,
    role,
    height = 250,
    isDark = false,
}: LiveTrackingMapProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<any>(null)
    const workerMarkerRef = useRef<any>(null)
    const destMarkerRef = useRef<any>(null)
    const directionsRendererRef = useRef<any>(null)
    const polylineRef = useRef<any>(null)
    const boundsInitialisedRef = useRef(false)  // fitBounds only once — never on live location updates
    const [ready, setReady] = useState(false)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [secAgo, setSecAgo] = useState<number | null>(null)
    const [routeInfo, setRouteInfo] = useState<{ distKm: string; durationMin: string } | null>(null)

    // Load Maps script once
    useEffect(() => {
        loadGoogleMaps().then(() => setReady(true)).catch(e => setLoadError(e.message))
    }, [])

    // Init map
    useEffect(() => {
        if (!ready || !containerRef.current || mapRef.current) return
        const center = workerLat && workerLng
            ? { lat: workerLat, lng: workerLng }
            : { lat: 20.5937, lng: 78.9629 }
        const gm = (window as any).google.maps
        mapRef.current = new gm.Map(containerRef.current, {
            center,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            gestureHandling: 'greedy',   // 1-finger pan on mobile (no two-finger warning)
        })
    }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

    // Update worker marker
    useEffect(() => {
        if (!ready || !mapRef.current || workerLat == null || workerLng == null) return
        const gm = (window as any).google.maps
        const pos = { lat: workerLat, lng: workerLng }
        const icon = buildPersonIcon(gm, role === 'worker' ? '#3b82f6' : '#dc2626')

        if (workerMarkerRef.current) {
            workerMarkerRef.current.setPosition(pos)
            workerMarkerRef.current.setIcon(icon)
        } else {
            workerMarkerRef.current = new gm.Marker({
                position: pos,
                map: mapRef.current,
                title: role === 'worker' ? 'You (Worker)' : "Worker's Location",
                icon,
                zIndex: 10,
            })
        }
    }, [ready, workerLat, workerLng, role])

    // Destination marker
    useEffect(() => {
        if (!ready || !mapRef.current || destinationLat == null || destinationLng == null) return
        const gm = (window as any).google.maps
        const pos = { lat: destinationLat, lng: destinationLng }

        if (destMarkerRef.current) {
            destMarkerRef.current.setPosition(pos)
        } else {
            destMarkerRef.current = new gm.Marker({
                position: pos,
                map: mapRef.current,
                title: 'Job Location',
                icon: buildDestinationIcon(gm),
                zIndex: 5,
            })
        }
    }, [ready, destinationLat, destinationLng])

    // Direction route — try Directions API, fall back to dashed polyline
    useEffect(() => {
        if (!ready || !mapRef.current) return
        if (workerLat == null || workerLng == null || destinationLat == null || destinationLng == null) return

        const gm = (window as any).google.maps
        const origin = { lat: workerLat, lng: workerLng }
        const destination = { lat: destinationLat, lng: destinationLng }

        // Try the Directions API (requires Directions API enabled on the key)
        const svc = new gm.DirectionsService()
        svc.route(
            { origin, destination, travelMode: gm.TravelMode.DRIVING },
            (result: any, status: string) => {
                if (status === 'OK' && result) {
                    // Clear any fallback polyline
                    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null }

                    if (!directionsRendererRef.current) {
                        directionsRendererRef.current = new gm.DirectionsRenderer({
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: '#3b82f6',
                                strokeOpacity: 0.85,
                                strokeWeight: 5,
                                icons: [{
                                    icon: { path: gm.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: '#fff', fillOpacity: 1, strokeColor: '#3b82f6', strokeWeight: 1 },
                                    offset: '50%',
                                }],
                            },
                        })
                        directionsRendererRef.current.setMap(mapRef.current)
                    }
                    directionsRendererRef.current.setDirections(result)

                    // Extract distance & duration
                    const leg = result.routes[0]?.legs[0]
                    if (leg) {
                        setRouteInfo({ distKm: leg.distance.text, durationMin: leg.duration.text })

                        // ── Key fix: snap destination marker to the road-resolved endpoint ──
                        // leg.end_location is where Google Maps actually places the address on
                        // the road network, which is more precise than raw stored lat/lng.
                        if (destMarkerRef.current && leg.end_location) {
                            destMarkerRef.current.setPosition(leg.end_location)
                        }
                    }

                    // Fit map to show full route — only on very first load, never when live location updates
                    if (!boundsInitialisedRef.current) {
                        boundsInitialisedRef.current = true
                        mapRef.current.fitBounds(result.routes[0].bounds)
                    }
                } else {
                    // Fallback: straight dashed line
                    if (!polylineRef.current) {
                        polylineRef.current = new gm.Polyline({
                            path: [origin, destination],
                            geodesic: true,
                            strokeColor: '#3b82f6',
                            strokeOpacity: 0,
                            strokeWeight: 0,
                            icons: [{
                                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.8, scale: 4, strokeColor: '#3b82f6' },
                                offset: '0',
                                repeat: '20px',
                            }],
                        })
                        polylineRef.current.setMap(mapRef.current)

                        // Fit both points — only on very first load
                        if (!boundsInitialisedRef.current) {
                            boundsInitialisedRef.current = true
                            const bounds = new gm.LatLngBounds()
                            bounds.extend(origin)
                            bounds.extend(destination)
                            mapRef.current.fitBounds(bounds)
                        }
                    } else {
                        polylineRef.current.setPath([origin, destination])
                    }
                    setRouteInfo(null)
                }
            }
        )
    }, [ready, workerLat, workerLng, destinationLat, destinationLng])

    // "X sec ago" countdown
    useEffect(() => {
        if (!locationUpdatedAt) { setSecAgo(null); return }
        const update = () => setSecAgo(Math.round((Date.now() - locationUpdatedAt) / 1000))
        update()
        const t = setInterval(update, 1000)
        return () => clearInterval(t)
    }, [locationUpdatedAt])

    if (loadError) return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl p-6 text-center"
            style={{ background: isDark ? '#2a0000' : '#fff0f0', height }}>
            <MapPin className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-500">Map failed to load: {loadError}</p>
        </div>
    )

    return (
        <div className="relative rounded-xl overflow-hidden border" style={{ height, borderColor: isDark ? '#3a3a3a' : '#e5e7eb', touchAction: 'none' }}>
            {/* Waiting overlay */}
            {(!workerLat || !workerLng) && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2"
                    style={{ background: isDark ? '#1a1a1a' : '#f9fafb' }}>
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                    <p className="text-xs font-medium" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                        Waiting for worker location…
                    </p>
                </div>
            )}

            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', touchAction: 'none' }}
            />

            {/* Route info badge */}
            {routeInfo && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg"
                    style={{ background: 'rgba(59,130,246,0.92)', color: '#fff' }}>
                    🚗 {routeInfo.distKm} · {routeInfo.durationMin}
                </div>
            )}

            {/* Last updated live badge */}
            {secAgo !== null && (
                <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                    {secAgo < 10 ? 'Live' : `${secAgo}s ago`}
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                    <span style={{ color: role === 'worker' ? '#60a5fa' : '#f87171' }}>●</span> Worker
                </div>
                {(destinationLat && destinationLng) && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                        <span style={{ color: '#34d399' }}>●</span> Job Location
                    </div>
                )}
            </div>
        </div>
    )
}
