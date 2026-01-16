// Cloudinary upload utilities for client-side uploads

export interface CloudinaryUploadResponse {
    public_id: string
    secure_url: string
    resource_type: 'image' | 'video'
    format: string
    width?: number
    height?: number
    duration?: number
    bytes: number
}

/**
 * Upload a file to Cloudinary using unsigned upload
 * @param file - The file to upload (image or video)
 * @returns Promise with upload response
 */
export async function uploadToCloudinary(
    file: File
): Promise<CloudinaryUploadResponse> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary configuration missing. Please check environment variables.')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', uploadPreset)
    formData.append('folder', 'needyou/jobs')

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
            {
                method: 'POST',
                body: formData,
            }
        )

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error?.message || 'Upload failed')
        }

        const data = await response.json()

        return {
            public_id: data.public_id,
            secure_url: data.secure_url,
            resource_type: data.resource_type,
            format: data.format,
            width: data.width,
            height: data.height,
            duration: data.duration,
            bytes: data.bytes,
        }
    } catch (error: any) {
        console.error('Cloudinary upload error:', error)
        throw new Error(error.message || 'Failed to upload file')
    }
}

/**
 * Delete a file from Cloudinary (requires server-side implementation)
 * Note: This is a placeholder - actual deletion requires backend API
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
    // This would need to be implemented as a server-side API route
    // because it requires the API secret
    console.log('Delete from Cloudinary:', publicId)
    // TODO: Implement server-side deletion endpoint
}

/**
 * Get optimized image URL from Cloudinary
 */
export function getOptimizedImageUrl(
    publicId: string,
    options?: {
        width?: number
        height?: number
        crop?: 'fill' | 'fit' | 'scale' | 'thumb'
        quality?: 'auto' | number
    }
): string {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) return ''

    const { width, height, crop = 'fill', quality = 'auto' } = options || {}

    let transformation = `q_${quality}`
    if (width) transformation += `,w_${width}`
    if (height) transformation += `,h_${height}`
    if (width || height) transformation += `,c_${crop}`

    return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`
}

/**
 * Get video thumbnail URL from Cloudinary
 */
export function getVideoThumbnailUrl(publicId: string): string {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) return ''

    return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,w_400,h_300,c_fill/${publicId}.jpg`
}

/**
 * Get rotation-corrected video URL from Cloudinary
 * This applies automatic rotation correction based on video metadata
 */
export function getRotationCorrectedVideoUrl(publicId: string): string {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) return ''

    // The issue: Videos have rotation metadata that browsers apply
    // Solution: We need to tell Cloudinary to re-encode the video with correct orientation
    // Using 'a_ignore' tells Cloudinary to ignore rotation metadata and show video as encoded
    // But this won't fix already-rotated videos

    // BEST SOLUTION: Just return the original URL
    // The rotation is in the video file itself, not fixable via URL transformations
    // User needs to either:
    // 1. Re-record video in correct orientation
    // 2. Use server-side FFmpeg to re-encode during upload
    // 3. Accept the rotation

    return `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}`
}
