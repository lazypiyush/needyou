'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

interface ThemeToggleProps {
    variant?: 'floating' | 'inline'
}

export default function ThemeToggle({ variant = 'floating' }: ThemeToggleProps) {
    const { theme, setTheme, systemTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (mounted) {
            console.log('🎨 Current theme:', theme)
            console.log('🎨 System theme:', systemTheme)
            console.log('🎨 HTML class:', document.documentElement.className)
        }
    }, [theme, systemTheme, mounted])

    if (!mounted) {
        return (
            <div className={variant === 'floating'
                ? "w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
                : "w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"
            } />
        )
    }

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const toggleTheme = () => {
        const newTheme = isDark ? 'light' : 'dark'
        console.log('🔄 Toggling theme from', currentTheme, 'to', newTheme)
        setTheme(newTheme)
    }

    // Floating variant - fixed position in top right corner
    if (variant === 'floating') {
        return (
            <button
                onClick={toggleTheme}
                className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/90 dark:bg-[#1c1c1c]/90 backdrop-blur-md hover:bg-white dark:hover:bg-[#202020] transition-all shadow-lg hover:shadow-xl border border-gray-200 dark:border-gray-700"
                aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
                {isDark ? (
                    <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                    <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                )}
            </button>
        )
    }

    // Inline variant - for use in headers/navbars
    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
                <Moon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
        </button>
    )
}
