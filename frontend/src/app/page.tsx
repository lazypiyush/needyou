'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, Shield, Users, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen w-full overflow-x-hidden transition-colors duration-500" 
      style={{
        background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))'
      }}>

      {/* Theme Toggle - Top Right */}
      <div className="fixed top-6 right-6 z-50">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 180 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-3 backdrop-blur-xl rounded-full shadow-lg hover:shadow-2xl transition-all duration-300"
          style={{
            backgroundColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.8)',
            borderWidth: '1px',
            borderColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 1)' : 'rgba(229, 231, 235, 1)'
          }}
        >
          {mounted && (
            theme === 'dark' ? (
              <Sun className="w-6 h-6 text-yellow-500" />
            ) : (
              <Moon className="w-6 h-6 text-blue-600" />
            )
          )}
        </motion.button>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          {/* Animated Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", duration: 1, bounce: 0.4 }}
            className="inline-block mb-8"
          >
            <div className="relative">
              <div 
                className="w-28 h-28 rounded-3xl flex items-center justify-center overflow-hidden"
                style={{
                  boxShadow: mounted && theme === 'dark' 
                    ? '0 0 20px rgba(255, 255, 255, 0.15), 0 0 40px rgba(255, 255, 255, 0.1), 0 20px 50px -12px rgba(0, 0, 0, 0.25)' 
                    : '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
              >
                <Image 
                  src="/logo.jpg" 
                  alt="NeedYou Logo" 
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              </div>
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center"
              >
                <Sparkles className="w-4 h-4 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl sm:text-6xl md:text-7xl font-black mb-6 leading-tight"
          >
            <span 
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent"
              style={{
                filter: mounted && theme === 'dark'
                  ? 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.25))'
                  : 'none'
              }}
            >
              Welcome to NeedYou
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl sm:text-2xl mb-4 font-semibold"
            style={{
              color: mounted && theme === 'dark' ? '#ffffff' : '#374151'
            }}
          >
            Your trusted platform for micro-jobs and services
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg mb-12 max-w-2xl mx-auto leading-relaxed"
            style={{
              color: mounted && theme === 'dark' ? '#ffffff' : '#4b5563'
            }}
          >
            Connect with skilled people nearby for household tasks, or offer your services 
            and earn money. Safe, verified, and easy to use.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20"
          >
            <Link href="/signup">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600"
                  initial={{ x: "100%" }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            </Link>
            
            <Link href="/signin">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold rounded-xl border-2 border-blue-600 dark:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all duration-300 shadow-lg"
              >
                Sign In
              </motion.button>
            </Link>
          </motion.div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-6xl mx-auto">
            {[
              { icon: Users, title: "Find Jobs", desc: "Discover nearby micro-jobs and earn money", color: "from-blue-500 to-cyan-500" },
              { icon: Sparkles, title: "Post Tasks", desc: "Get help quickly and affordably", color: "from-purple-500 to-pink-500" },
              { icon: Shield, title: "Safe & Verified", desc: "AI-powered KYC verification", color: "from-green-500 to-emerald-500" }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ y: -10 }}
                className="group relative backdrop-blur-xl p-8 rounded-3xl shadow-xl hover:shadow-2xl"
                style={{
                  backgroundColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.8)',
                  borderWidth: '1px',
                  borderColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(229, 231, 235, 1)',
                  color: mounted && theme === 'dark' ? '#ffffff' : '#1f2937'
                }}
              >
                <div className={`w-16 h-16 mx-auto mb-6 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">
                  {feature.title}
                </h3>
                <p className="leading-relaxed">
                  {feature.desc}
                </p>
                
                {/* Hover gradient border effect */}
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500`} />
              </motion.div>
            ))}
          </div>

          {/* Trust Badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-20 flex flex-wrap justify-center gap-6 items-center"
          >
            {["✅ Verified Workers", "🔒 Secure Payments", "⚡ Instant Booking", "💯 24/7 Support"].map((badge, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05, y: -2 }}
                className="px-6 py-3 backdrop-blur-xl rounded-full text-sm font-semibold shadow-md"
                style={{
                  backgroundColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.8)',
                  borderWidth: '1px',
                  borderColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(229, 231, 235, 1)',
                  color: mounted && theme === 'dark' ? '#ffffff' : '#374151'
                }}
              >
                {badge}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 text-center border-t backdrop-blur-xl"
        style={{
          borderColor: mounted && theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgb(229, 231, 235)',
          color: mounted && theme === 'dark' ? '#ffffff' : 'rgb(75, 85, 99)'
        }}
      >
        <p className="text-sm font-medium">
          © 2026 NeedYou. All rights reserved. | Built with 💙 in India
        </p>
      </footer>
    </div>
  )
}
