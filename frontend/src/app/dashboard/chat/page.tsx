'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import ChatModal from '@/components/ChatModal'

function ChatPageInner() {
    const params = useSearchParams()
    const router = useRouter()

    const jobId = params.get('jobId') || ''
    const jobTitle = params.get('jobTitle') || ''
    const otherUserId = params.get('otherUserId') || ''
    const otherUserName = params.get('otherUserName') || ''
    const otherUserEmail = params.get('otherUserEmail') || ''
    const otherUserPhone = params.get('otherUserPhone') || undefined

    // Missing required params → go back to dashboard
    if (!jobId || !otherUserId) {
        if (typeof window !== 'undefined') router.replace('/dashboard')
        return null
    }

    return (
        <ChatModal
            jobId={jobId}
            jobTitle={jobTitle}
            otherUserId={otherUserId}
            otherUserName={otherUserName}
            otherUserEmail={otherUserEmail}
            otherUserPhone={otherUserPhone}
            // "Close" navigates back naturally — this is a full page now
            onClose={() => router.back()}
            fullPage
        />
    )
}

export default function ChatPage() {
    return (
        <Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-black">
                <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            </div>
        }>
            <ChatPageInner />
        </Suspense>
    )
}
