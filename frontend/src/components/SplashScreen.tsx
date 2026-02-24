'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

/**
 * SplashScreen — two layers:
 *
 * 1. LAUNCH SPLASH  (native app only, once per session)
 *    Shows on first load, fades after 2.5 s, then hides.
 *
 * 2. AUTH SHIELD  (native app only)
 *    Keeps a plain dark overlay visible while auth.loading is true so users
 *    never see the sign-in screen flash before Firebase resolves the session.
 *    Fades out as soon as the auth state is known.
 */
export default function SplashScreen() {
    const { loading: authLoading } = useAuth();

    const [showSplash, setShowSplash] = useState(false); // launch splash
    const [splashFade, setSplashFade] = useState(false);
    const [showShield, setShowShield] = useState(true);  // start visible → no flash
    const [shieldFade, setShieldFade] = useState(false);

    useEffect(() => {
        // Not native → hide the shield that was shown by default
        if (!(window as any).Capacitor?.isNativePlatform()) {
            setShowShield(false);
            return;
        }

        // ── Launch splash: show once per session ──────────────────────────
        if (!sessionStorage.getItem('splashShown')) {
            sessionStorage.setItem('splashShown', '1');
            setShowSplash(true);

            const fadeTimer = setTimeout(() => setSplashFade(true), 2400);
            const hideTimer = setTimeout(() => setShowSplash(false), 2900);
            return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
        }
    }, []);

    // Dismiss auth shield once Firebase resolves (loading goes false)
    useEffect(() => {
        if (!(window as any).Capacitor?.isNativePlatform()) return;
        if (!authLoading) {
            // Small delay so the page behind has time to render → no flicker
            const t = setTimeout(() => setShieldFade(true), 200);
            const t2 = setTimeout(() => setShowShield(false), 700);
            return () => { clearTimeout(t); clearTimeout(t2); };
        }
    }, [authLoading]);

    return (
        <>
            {/* ── Auth shield ───────────────────────────────────────────── */}
            {showShield && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99998,
                    background: '#0f172a',
                    opacity: shieldFade ? 0 : 1,
                    transition: 'opacity 0.5s ease-out',
                    pointerEvents: shieldFade ? 'none' : 'all',
                }} />
            )}

            {/* ── Launch splash ─────────────────────────────────────────── */}
            {showSplash && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 99999,
                    background: 'linear-gradient(160deg, #0f172a 0%, #1a1040 50%, #0f172a 100%)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    opacity: splashFade ? 0 : 1,
                    transition: 'opacity 0.5s ease-out',
                }}>
                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                        <div style={{
                            position: 'absolute', inset: -8, borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
                        }} />
                        <img src="/logo.jpg" alt="NeedYou" style={{
                            width: 100, height: 100, borderRadius: '50%', objectFit: 'cover',
                            border: '3px solid rgba(99,102,241,0.7)',
                            boxShadow: '0 0 40px rgba(99,102,241,0.5)',
                            position: 'relative', zIndex: 1,
                            animation: 'scaleIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
                        }} />
                    </div>

                    <h1 style={{
                        color: '#fff', fontSize: '2rem', fontWeight: 800,
                        letterSpacing: '0.05em', marginBottom: '0.4rem',
                        animation: 'slideUp 0.5s 0.2s ease-out both',
                    }}>NeedYou</h1>

                    <p style={{
                        color: '#94a3b8', fontSize: '0.9rem',
                        animation: 'slideUp 0.5s 0.35s ease-out both',
                    }}>Find local services &amp; micro-jobs</p>

                    {/* Loading dots */}
                    <div style={{ display: 'flex', gap: 6, marginTop: '3rem', animation: 'slideUp 0.5s 0.5s ease-out both' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{
                                width: 7, height: 7, borderRadius: '50%', background: '#6366f1',
                                animation: `bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                            }} />
                        ))}
                    </div>

                    <style>{`
                        @keyframes scaleIn { from{transform:scale(0.6);opacity:0} to{transform:scale(1);opacity:1} }
                        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
                        @keyframes bounce { 0%,80%,100%{transform:scale(1);opacity:0.4} 40%{transform:scale(1.5);opacity:1} }
                    `}</style>
                </div>
            )}
        </>
    );
}
