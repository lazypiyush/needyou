'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen() {
    const [visible, setVisible] = useState(true);
    const [fadeOut, setFadeOut] = useState(false);

    useEffect(() => {
        // Only show splash inside Capacitor native app
        const cap = (window as any).Capacitor;
        if (!cap || !cap.isNativePlatform()) {
            setVisible(false);
            return;
        }

        // Start fade-out after 2.2s, remove after 2.7s
        const fadeTimer = setTimeout(() => setFadeOut(true), 2200);
        const hideTimer = setTimeout(() => setVisible(false), 2700);
        return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
    }, []);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 99999,
                background: 'linear-gradient(160deg, #0f172a 0%, #1a1040 50%, #0f172a 100%)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Inter, system-ui, sans-serif',
                opacity: fadeOut ? 0 : 1,
                transition: 'opacity 0.5s ease-out',
                pointerEvents: 'all',
            }}
        >
            {/* Glow ring */}
            <div style={{
                position: 'relative',
                marginBottom: '1.5rem',
                animation: 'pulse 2s ease-in-out infinite',
            }}>
                <div style={{
                    position: 'absolute', inset: -8,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
                }} />
                <img
                    src="/logo.jpg"
                    alt="NeedYou"
                    style={{
                        width: 100, height: 100,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid rgba(99,102,241,0.7)',
                        boxShadow: '0 0 40px rgba(99,102,241,0.5)',
                        position: 'relative',
                        zIndex: 1,
                        animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
                    }}
                />
            </div>

            {/* App name */}
            <h1 style={{
                color: '#ffffff',
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                marginBottom: '0.4rem',
                animation: 'slideUp 0.5s 0.2s ease-out both',
            }}>
                NeedYou
            </h1>

            {/* Tagline */}
            <p style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                fontWeight: 400,
                letterSpacing: '0.03em',
                animation: 'slideUp 0.5s 0.35s ease-out both',
            }}>
                Find local services &amp; micro-jobs
            </p>

            {/* Loading dots */}
            <div style={{
                display: 'flex', gap: '6px',
                marginTop: '3rem',
                animation: 'slideUp 0.5s 0.5s ease-out both',
            }}>
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                        width: 7, height: 7,
                        borderRadius: '50%',
                        background: '#6366f1',
                        animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                    }} />
                ))}
            </div>

            {/* CSS keyframes injected inline */}
            <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.4; }
          40%           { transform: scale(1.5); opacity: 1;   }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.05); }
        }
      `}</style>
        </div>
    );
}
