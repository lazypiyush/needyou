/**
 * Opens the chat as a full-screen overlay while spoofing the URL to /dashboard/chat?...
 * so the address bar shows a "chat page" and the native back button fires popstate —
 * without causing a page reload or losing React state.
 */
export function buildChatUrl(params: {
    jobId: string
    jobTitle: string
    otherUserId: string
    otherUserName: string
    otherUserEmail: string
    otherUserPhone?: string
}) {
    const q = new URLSearchParams({
        jobId: params.jobId,
        jobTitle: params.jobTitle,
        otherUserId: params.otherUserId,
        otherUserName: params.otherUserName,
        otherUserEmail: params.otherUserEmail,
        otherUserPhone: params.otherUserPhone || '',
    })
    return `/dashboard/chat?${q.toString()}`
}

/**
 * Navigate to the chat overlay by pushing the chat URL into history WITHOUT doing
 * a real Next.js page navigation. Call instead of router.push() when opening chat.
 * Dispatches a custom 'pushChatState' event so dashboard/page.tsx can react immediately
 * (history.pushState does NOT fire popstate).
 */
export function pushChatState(params: Parameters<typeof buildChatUrl>[0]) {
    window.history.pushState({ chatOverlay: true }, '', buildChatUrl(params))
    // Dispatch a custom event so the dashboard listener can open the overlay
    window.dispatchEvent(new Event('pushChatState'))
}

/**
 * Restore the dashboard URL after the chat overlay closes (X button).
 * Only call this when the chat was opened via pushChatState.
 */
export function popChatState() {
    if (window.history.state?.chatOverlay) {
        window.history.back()
    }
}
