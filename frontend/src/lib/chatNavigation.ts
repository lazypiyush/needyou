/**
 * Opens the chat as a full-screen overlay WITHOUT changing the browser URL.
 *
 * Why no URL change: changing the path to /dashboard/chat causes Next.js to
 * intercept the back-button popstate and re-render the dashboard (full refresh).
 * By keeping the URL as /dashboard and only pushing a history STATE, the back
 * button fires popstate → dashboard closes the overlay — zero refresh, full
 * state preserved.
 */
export type ChatParams = {
    jobId: string
    jobTitle: string
    otherUserId: string
    otherUserName: string
    otherUserEmail: string
    otherUserPhone?: string
}

/**
 * Push a history entry with chat params WITHOUT changing the URL.
 * Dispatches a custom 'pushChatState' event so the dashboard can react
 * immediately (pushState does NOT fire popstate by itself).
 */
export function pushChatState(params: ChatParams) {
    window.history.pushState({ chatOverlay: true, chatParams: params }, '')
    window.dispatchEvent(new Event('pushChatState'))
}

/**
 * Pop the chat history entry when closing the overlay via the X button.
 * Only call this if the chat was opened via pushChatState.
 */
export function popChatState() {
    if (window.history.state?.chatOverlay) {
        window.history.back()
    }
}
