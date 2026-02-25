import { useEffect, useRef } from 'react'

// Monotonically increasing counter so each modal gets a unique depth.
// This lets each handler know whether ITS own entry was popped or a deeper one.
let _depth = 0

export function useModalHistory(isOpen: boolean, onClose: () => void) {
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose

    useEffect(() => {
        if (!isOpen) return

        _depth++
        const myDepth = _depth

        window.history.pushState({ modal: true, depth: myDepth }, '')

        const handlePopState = (e: PopStateEvent) => {
            // 'e.state' is the state we just navigated BACK TO.
            // If its depth >= myDepth it means something above us was popped
            // (e.g. a chat overlay or a child modal) — don't close this modal.
            const newDepth: number = e.state?.depth ?? 0
            if (newDepth >= myDepth) return
            onCloseRef.current()
        }

        window.addEventListener('popstate', handlePopState)

        return () => {
            window.removeEventListener('popstate', handlePopState)
            // If the modal was closed via the UI (X button), the history entry
            // is still there — pop it so stale entries don't accumulate.
            // We only back() if our entry is still the current top.
            if (window.history.state?.depth === myDepth) {
                window.history.back()
            }
        }
    }, [isOpen])
}
