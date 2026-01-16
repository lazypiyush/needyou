// Distance calculation utilities using Haversine formula
// All distances are in kilometers

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
    return degrees * (Math.PI / 180)
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371 // Earth's radius in kilometers

    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lon2 - lon1)

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const distance = R * c // Distance in kilometers

    return Math.round(distance * 10) / 10 // Round to 1 decimal place
}

/**
 * Filter jobs by distance from user location
 * @param jobs Array of jobs
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @param maxDistance Maximum distance in kilometers
 * @returns Filtered jobs within the distance
 */
export function filterJobsByDistance(
    jobs: any[],
    userLat: number,
    userLon: number,
    maxDistance: number
): any[] {
    return jobs.filter((job) => {
        if (!job.location?.latitude || !job.location?.longitude) {
            return false
        }

        const distance = calculateDistance(
            userLat,
            userLon,
            job.location.latitude,
            job.location.longitude
        )

        return distance <= maxDistance
    })
}

/**
 * Filter jobs by city
 * @param jobs Array of jobs
 * @param userCity User's city name
 * @returns Jobs in the same city
 */
export function filterJobsByCity(jobs: any[], userCity: string): any[] {
    return jobs.filter(
        (job) =>
            job.location?.city?.toLowerCase() === userCity.toLowerCase()
    )
}

/**
 * Add distance property to jobs
 * @param jobs Array of jobs
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @returns Jobs with distance property added
 */
export function addDistanceToJobs(
    jobs: any[],
    userLat: number,
    userLon: number
): any[] {
    return jobs.map((job) => {
        if (!job.location?.latitude || !job.location?.longitude) {
            return { ...job, distance: null }
        }

        const distance = calculateDistance(
            userLat,
            userLon,
            job.location.latitude,
            job.location.longitude
        )

        return { ...job, distance }
    })
}
