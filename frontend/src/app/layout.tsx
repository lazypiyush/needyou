import { AuthProvider } from '@/context/AuthContext'
import { ThemeProvider } from 'next-themes'
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NeedYou - Connect, Help, Grow',
  description: 'A platform to connect people who need help with those who can provide it',
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
