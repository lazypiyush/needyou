import { useEffect, useRef } from 'react'

/**
 * Pushes a dummy history entry when a modal opens so the Android/browser
 * back button fires `popstate` and closes the modal instead of exiting the app.
 *
 * Stacks correctly: if two modals are open each has its own history entry.
 * Pressing back closes the top-most modal first, then the next, etc.
 *
 * Usage: call at the top of any modal —  useModalHistory(true, onClose)
 */
export function useModalHistory(isOpen: boolean, onClose: () => void) {
    // Keep onClose stable so we don't re-register listeners unnecessarily
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!isOpen) return

        // Push a history entry so back button has something to pop
        window.history.pushState({ modal: true }, '')

        const handlePopState = () => {
            // Back button was pressed — close this modal
            onCloseRef.current()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            // Modal closed via UI (X button / programmatic) — just remove listener.
            // We intentionally do NOT call history.back() here because that would
            // fire popstate on the parent modal and close it unexpectedly.
            window.removeEventListener('popstate', handlePopState)
        }
    }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps
}
