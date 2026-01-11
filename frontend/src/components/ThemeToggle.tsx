'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle() {
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
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        )
    }

    const currentTheme = theme === 'system' ? systemTheme : theme
    const isDark = currentTheme === 'dark'

    const toggleTheme = () => {
        const newTheme = isDark ? 'light' : 'dark'
        console.log('🔄 Toggling theme from', currentTheme, 'to', newTheme)
        setTheme(newTheme)
    }

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100 dark:bg-[#1c1c1c] hover:bg-gray-200 dark:hover:bg-[#202020] transition-colors"
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
