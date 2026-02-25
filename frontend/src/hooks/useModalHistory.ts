import { useEffect, useRef } from 'react'

/**
 * Pushes a dummy history entry when a modal opens so the Android/browser
 * back button fires `popstate` and closes the modal instead of exiting the app.
 *
 * Usage: call this hook at the top of any modal component —
 *   useModalHistory(true, onClose)
 */
export function useModalHistory(isOpen: boolean, onClose: () => void) {
    const pushed = useRef(false)

    useEffect(() => {
        if (!isOpen) {
            // If WE pushed a state and the modal was closed programmatically
            // (not via back button), pop the state we pushed so history stays clean.
            if (pushed.current) {
                pushed.current = false
                // Only go back if our modal state is the current one
                if (window.history.state?.modal === true) {
                    window.history.back()
                }
            }
            return
        }

        // Push a history entry so back button has something to pop
        window.history.pushState({ modal: true }, '')
        pushed.current = true

        const handlePopState = (e: PopStateEvent) => {
            // Back button was pressed — close the modal
            pushed.current = false
            onClose()
        }

        window.addEventListener('popstate', handlePopState)
        return () => {
            window.removeEventListener('popstate', handlePopState)
        }
    }, [isOpen, onClose])
}
