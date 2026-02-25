'use client';

import { useEffect, useState } from 'react';

export default function OfflineDetector() {
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        setIsOffline(!navigator.onLine);
        const goOffline = () => setIsOffline(true);
        const goOnline = () => setIsOffline(false);
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    if (!isOffline) return null;

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
            padding: '2rem',
            color: '#fff',
        }}>
            {/* Logo inside spinning ring */}
            <div style={{ position: 'relative', width: 100, height: 100, marginBottom: '2rem' }}>
                {/* Spinning ring */}
                <svg
                    width="100" height="100"
                    viewBox="0 0 100 100"
                    style={{ position: 'absolute', inset: 0, animation: 'spin 1.8s linear infinite' }}
                >
                    <circle
                        cx="50" cy="50" r="46"
                        fill="none"
                        stroke="url(#grad)"
                        strokeWidth="4"
                        strokeDasharray="200 90"
                        strokeLinecap="round"
                    />
                    <defs>
                        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>
                </svg>
                {/* Logo */}
                <img
                    src="/logo.jpg"
                    alt="NeedYou"
                    style={{
                        position: 'absolute',
                        inset: 8,
                        width: 84, height: 84,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(99,102,241,0.4)',
                        boxShadow: '0 0 20px rgba(99,102,241,0.3)',
                    }}
                />
            </div>

            {/* Wifi off icon */}
            <div style={{
                width: 56, height: 56, marginBottom: '1.25rem',
                background: 'rgba(239,68,68,0.15)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                    <circle cx="12" cy="20" r="1" fill="#ef4444" stroke="none" />
                </svg>
            </div>

            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', textAlign: 'center' }}>
                No Internet Connection
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '2rem', textAlign: 'center', maxWidth: 280 }}>
                Please check your Wi-Fi or mobile data and try again.
            </p>

            <button
                onClick={() => window.location.reload()}
                style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.85rem 2.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
                🔄 Retry
            </button>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
