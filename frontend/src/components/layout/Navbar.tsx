'use client'

import { Home, Search, Briefcase, MessageSquare, Bell, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <>
      {/* Desktop - Top Navbar */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 bg-white dark:bg-[#1D2226] border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Left - Logo + Search */}
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary rounded flex items-center justify-center text-white font-bold text-xl">
                  N
                </div>
                <span className="font-bold text-xl hidden lg:block">NeedYou</span>
              </Link>
              
              <div className="relative hidden lg:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search jobs, people..."
                  className="pl-10 pr-4 py-2 bg-[#EDF3F8] dark:bg-[#38434F] rounded-md w-80 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Right - Navigation Icons */}
            <div className="flex items-center gap-8">
              <NavItem icon={<Home />} label="Home" href="/" />
              <NavItem icon={<Briefcase />} label="Jobs" href="/jobs" />
              <NavItem icon={<MessageSquare />} label="Messages" href="/messages" badge={3} />
              <NavItem icon={<Bell />} label="Notifications" href="/notifications" badge={5} />
              <NavItem icon={<User />} label="Profile" href="/profile" />
              
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                {theme === 'dark' ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet - Bottom Navbar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1D2226] border-t border-gray-200 dark:border-gray-700 z-50">
        <div className="flex items-center justify-around h-16 px-2">
          <NavItem icon={<Home />} label="Home" href="/" mobile />
          <NavItem icon={<Briefcase />} label="Jobs" href="/jobs" mobile />
          <NavItem icon={<MessageSquare />} label="Messages" href="/messages" badge={3} mobile />
          <NavItem icon={<Bell />} label="Notifications" href="/notifications" badge={5} mobile />
          <NavItem icon={<User />} label="Me" href="/profile" mobile />
        </div>
      </nav>

      {/* Spacer for fixed navbar */}
      <div className="hidden md:block h-14" />
      <div className="md:hidden h-16" />
    </>
  )
}

function NavItem({ icon, label, href, badge, mobile }: any) {
  return (
    <Link
      href={href}
      className={`
        relative flex flex-col items-center justify-center gap-1 
        hover:text-primary cursor-pointer group
        ${mobile ? 'py-2' : ''}
      `}
    >
      <div className="relative">
        <div className="w-6 h-6 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        {badge && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-xs font-medium ${mobile ? 'block' : 'hidden lg:block'}`}>
        {label}
      </span>
    </Link>
  )
}
