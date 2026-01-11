import { ReactNode } from 'react'

export default function OnboardingLayout({
    children,
}: {
    children: ReactNode
}) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center px-4 py-12"
            style={{
                background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
            }}
        >
            {children}
        </div>
    )
}
