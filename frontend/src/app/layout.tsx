import { AuthProvider } from '@/context/AuthContext'
import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'
import PushNotificationInit from '@/components/PushNotificationInit'
import SplashScreen from '@/components/SplashScreen'
import OfflineDetector from '@/components/OfflineDetector'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://need-you.xyz'),
  title: {
    default: 'NeedYou - Find Local Services & Micro-Jobs in India',
    template: '%s | NeedYou'
  },
  description: 'Connect with skilled workers for household tasks, repairs, and services. Post jobs or offer your skills. Safe, verified, and trusted micro-job platform in India.',
  keywords: [
    'micro jobs India',
    'local services',
    'household tasks',
    'find workers',
    'part-time jobs',
    'gig economy',
    'service marketplace',
    'plumber near me',
    'electrician services',
    'home repairs',
    'freelance work India',
    'earn money online',
    'task marketplace'
  ],
  authors: [{ name: 'NeedYou Team' }],
  creator: 'NeedYou',
  publisher: 'NeedYou',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: 'https://need-you.xyz',
    siteName: 'NeedYou',
    title: 'NeedYou - Find Local Services & Micro-Jobs in India',
    description: 'Connect with skilled workers for household tasks, repairs, and services. Post jobs or offer your skills. Safe, verified, and trusted micro-job platform.',
    images: [
      {
        url: '/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'NeedYou - Local Services Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NeedYou - Find Local Services & Micro-Jobs',
    description: 'Connect with skilled workers for household tasks. Safe, verified, and trusted platform.',
    images: ['/logo.jpg'],
    creator: '@needyou',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code', // Add your Google Search Console verification code
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
  alternates: {
    canonical: 'https://need-you.xyz',
  },
  category: 'Services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="bg-white dark:bg-[#181818] text-gray-900 dark:text-white transition-colors duration-300">
        <Providers>
          <AuthProvider>
            <SplashScreen />
            <OfflineDetector />
            <PushNotificationInit />
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  )
}
