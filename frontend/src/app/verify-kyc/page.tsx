'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, ShieldCheck, CheckCircle, AlertCircle, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { getUserKycStatus, updateKycStatus } from '@/lib/auth'
import Link from 'next/link'
import Image from 'next/image'
import {
    CHALLENGE_POOL, pickChallenges, getInstruction,
    avgEAR, earLeft, earRight, computeYaw, computePitch, computeRoll,
    smileRatio, mouthOpenRatio, browsRaised, winkLeft, winkRight,
    countFingers, isThumbUp, isThumbDown, isFist, isOpenPalm,
    isRockOn, isCallMe, isOkSign, isLShape, isCrossedFingers, isPointUp,
    type ChallengeSpec
} from './challenges'

type Phase = 'liveness' | 'digilocker' | 'complete'
type LivenessState = 'idle' | 'loading' | 'ready' | 'challenge' | 'passed' | 'failed'
type ActiveChallenge = ChallengeSpec & { seed?: string }

declare global {
    interface Window {
        DigiboostSdk?: (opts: {
            gateway: string; token: string; selector?: string; title?: string
            onSuccess: (data: any) => void; onFailure: (error: any) => void
        }) => { cleanup: () => void }
    }
}

const SESSION_STEPS = 3          // challenges per session
const PASS_THRESHOLD = 2         // must pass at least 2/3
const BLINK_EAR = 0.21
const BLINK_FRAMES = 2
const YAW_DEG = 16
const PITCH_THRESH = 12
const ROLL_DEG = 12
const SMILE_THR = 0.30
const MOUTH_OPEN_THR = 0.50
const BROW_THR = 0.04
const CLOSE_EAR = 0.15
const CLOSE_HOLD_FRAMES = 25
const FINGER_HOLD_FRAMES = 12   // must show finger count steadily

function VerifyKycContent() {
    const { user, loading: authLoading } = useAuth()
    const router = useRouter()

    const [phase, setPhase] = useState<Phase>('liveness')
    const [pageLoading, setPageLoading] = useState(true)
    const [aadhaarFetching, setAadhaarFetching] = useState(false)
    const [digilockerLaunching, setDigilockerLaunching] = useState(false)
    const [digilockerReady, setDigilockerReady] = useState(false)
    const [digilockerRetry, setDigilockerRetry] = useState(0)  // incremented to force re-init
    const [needsRefresh, setNeedsRefresh] = useState(false)    // true when Aadhaar consent was skipped
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const [livenessState, setLivenessState] = useState<LivenessState>('idle')
    const [currentIdx, setCurrentIdx] = useState(0)
    const [currentChallenge, setCurrentChallenge] = useState<ActiveChallenge>(CHALLENGE_POOL[0])
    const [progress, setProgress] = useState(0)
    const [faceInFrame, setFaceInFrame] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const rafRef = useRef<number | null>(null)
    const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const faceLandmarkerRef = useRef<any>(null)
    const handLandmarkerRef = useRef<any>(null)
    const recognitionRef = useRef<any>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const videoChunksRef = useRef<Blob[]>([])

    // Per-step tracking refs
    const sessionRef = useRef<ActiveChallenge[]>([])
    const stepIdxRef = useRef(0)
    const passedRef = useRef(0)
    const stepActiveRef = useRef(false)
    const blinkCountRef = useRef(0)
    const blinkConsecRef = useRef(0)
    const closeHoldRef = useRef(0)
    const fingerHoldRef = useRef(0)
    const waveHistRef = useRef<number[]>([])
    const pitchBaseRef = useRef<number | null>(null)

    const sdkCleanup = useRef<(() => void) | null>(null)

    // ─── Auth + KYC load ──────────────────────────────────────────────────────
    useEffect(() => { if (!authLoading && !user) router.replace('/signin') }, [user, authLoading, router])

    useEffect(() => {
        const load = async () => {
            if (!user) return
            try {
                const status = await getUserKycStatus(user.uid)
                if (!status) { setPageLoading(false); return }
                if (status.kycVerified) { router.replace('/onboarding/education'); return }
                if (status.livenessVerified && status.aadhaarVerified) {
                    await updateKycStatus(user.uid, 'complete').catch(() => { })
                    router.replace('/onboarding/education'); return
                }
                setPhase(status.livenessVerified ? 'digilocker' : 'liveness')
            } catch (e) { console.error(e) } finally { setPageLoading(false) }
        }
        load()
    }, [user, router])

    // ─── APK fallback: re-check KYC when user returns from DigiLocker in Chrome ─
    // When DigiLocker opens in an external browser on Android, the onSuccess callback
    // never fires in the WebView. When the user returns to the app, this listener
    // polls Firestore and advances the phase if kycVerified is now true.
    useEffect(() => {
        const handleVisibility = async () => {
            if (document.visibilityState !== 'visible') return
            if (phase !== 'digilocker' || !user) return
            try {
                const status = await getUserKycStatus(user.uid)
                if (status?.kycVerified) {
                    setPhase('complete')
                } else if (status?.livenessVerified && status?.aadhaarVerified) {
                    await updateKycStatus(user.uid, 'complete').catch(() => { })
                    setPhase('complete')
                }
            } catch { /* ignore */ }
        }
        document.addEventListener('visibilitychange', handleVisibility)
        return () => document.removeEventListener('visibilitychange', handleVisibility)
    }, [phase, user])

    // ─── Eagerly inject SDK script on mount ──────────────────────────────────
    // This runs as soon as the component mounts (even during liveness phase)
    // so by the time liveness completes the script is already cached.
    const DIGI_SDK_URL = 'https://cdn.jsdelivr.net/gh/surepassio/surepass-digiboost-web-sdk@latest/index.min.js'
    useEffect(() => {
        if (document.querySelector(`script[src="${DIGI_SDK_URL}"]`)) return  // already injected
        const s = document.createElement('script')
        s.src = DIGI_SDK_URL
        s.async = true
        document.head.appendChild(s)
    }, [])

    // ─── SDK loader helper ────────────────────────────────────────────────────
    // Resolves once window.DigiboostSdk is available. Handles 3 cases:
    // A) Already loaded  → resolves immediately
    // B) Script in DOM but still loading → attaches onload listener
    // C) Script not in DOM → creates it, attaches onload listener
    const loadDigiSdk = (): Promise<void> => new Promise((resolve, reject) => {
        if (window.DigiboostSdk) { resolve(); return }
        let s = document.querySelector<HTMLScriptElement>(`script[src="${DIGI_SDK_URL}"]`)
        if (!s) {
            s = document.createElement('script')
            s.src = DIGI_SDK_URL
            s.async = true
            document.head.appendChild(s)
        }
        const timeout = setTimeout(() => reject(new Error('DigiLocker SDK timed out. Please check your connection and try again.')), 15000)
        s.addEventListener('load', () => { clearTimeout(timeout); resolve() }, { once: true })
        s.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('DigiLocker SDK failed to download. Please refresh the page.')) }, { once: true })
    })

    // ─── Pre-fetch DigiLocker token when phase becomes 'digilocker' ───────────
    useEffect(() => {
        if (phase !== 'digilocker' || !user) return
        setDigilockerReady(false)
        setError('')

        const init = async () => {
            try {
                // 12 s client-side abort — server already has a 10 s abort, this is a safety net
                const fetchCtrl = new AbortController()
                const fetchTimer = setTimeout(() => fetchCtrl.abort(), 12000)

                let res: Response
                try {
                    ;[res] = await Promise.all([
                        fetch('/api/kyc-aadhaar', {
                            method: 'POST',
                            signal: fetchCtrl.signal,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.uid }),
                        }),
                        loadDigiSdk(),
                    ])
                } catch (e: any) {
                    clearTimeout(fetchTimer)
                    if (e?.name === 'AbortError')
                        throw new Error('DigiLocker service timed out. Please try again.')
                    throw e
                }
                clearTimeout(fetchTimer)

                const data = await res.json()
                if (!res.ok) { setError(data.error || 'Could not connect to DigiLocker.'); return }

                const { token: sessionToken, clientId } = data

                // Ensure off-screen container exists
                let container = document.getElementById('sp-digilocker-btn')
                if (!container) {
                    container = document.createElement('div')
                    container.id = 'sp-digilocker-btn'
                    container.style.cssText = 'position:fixed;top:-999px;left:-999px;width:1px;height:1px;overflow:hidden;'
                    document.body.appendChild(container)
                }
                // Destroy previous SDK instance AND clear its button from the DOM.
                // The SDK's cleanup() resets popup state but leaves the <button> element in place
                // with an internal d=true (processing) flag. On retry, DigiboostSdk() appends a
                // SECOND button — our querySelector('#sp-digilocker-btn button') returns the FIRST
                // (broken) one, silently ignoring clicks and leaving digilockerLaunching stuck true.
                sdkCleanup.current?.()
                container.innerHTML = ''  // remove stale SDK button(s) before re-init


                const instance = window.DigiboostSdk!({
                    gateway: 'production',
                    token: sessionToken,
                    selector: '#sp-digilocker-btn',
                    title: 'Verify Aadhaar',
                    onSuccess: async (result: any) => {
                        instance?.cleanup(); sdkCleanup.current = null
                        setDigilockerLaunching(false)
                        setSuccess('✅ Authorized! Fetching your details...')
                        await fetchAndComplete(result?.client_id || result?.clientId || clientId)
                    },
                    onFailure: (err: any) => {
                        instance?.cleanup(); sdkCleanup.current = null
                        setDigilockerLaunching(false)
                        const msg = typeof err === 'string' ? err : (err?.message || '')
                        if (msg.toLowerCase().includes('cancel')) setError('Verification cancelled. Please try again.')
                        else setError(msg || 'Verification failed. Please try again.')
                        // Force full re-init on next attempt — SDK leaves internal d=true (processing flag)
                        // stuck after cleanup, so programmatic .click() on the old button is silently ignored.
                        setDigilockerReady(false)
                        setDigilockerRetry(n => n + 1)
                    },
                })
                sdkCleanup.current = instance?.cleanup
                setDigilockerReady(true)
            } catch (e: any) {
                setError(e.message || 'Failed to initialise DigiLocker.')
            }
        }
        init()

        return () => { sdkCleanup.current?.(); sdkCleanup.current = null }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, user?.uid, digilockerRetry])

    // ─── Camera stop ──────────────────────────────────────────────────────────

    const stopAll = useCallback(() => {
        stepActiveRef.current = false
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        if (stepTimerRef.current) { clearTimeout(stepTimerRef.current); stepTimerRef.current = null }
        recognitionRef.current?.abort?.(); recognitionRef.current = null
        // Discard recording — video is only saved in finishLiveness() on verified pass
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop() } catch { }
        }
        mediaRecorderRef.current = null
        videoChunksRef.current = []   // clear chunks so nothing leaks to next attempt
        streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null
        if (videoRef.current) videoRef.current.srcObject = null
    }, [])

    // ─── Load models ──────────────────────────────────────────────────────────
    const loadModels = async (needHand: boolean) => {
        const { FaceLandmarker, HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')
        const baseOpts = (mp: string) => ({ baseOptions: { modelAssetPath: mp, delegate: 'GPU' as const }, runningMode: 'VIDEO' as const })

        if (!faceLandmarkerRef.current)
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(fs, {
                ...baseOpts('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'),
                numFaces: 1, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
            })

        if (needHand && !handLandmarkerRef.current)
            handLandmarkerRef.current = await HandLandmarker.createFromOptions(fs, {
                ...baseOpts('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'),
                numHands: 1, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
            })
    }



    // ─── Main start ───────────────────────────────────────────────────────────
    const startLiveness = async () => {
        setError(''); setLivenessState('loading')

        try {
            const session = pickChallenges(SESSION_STEPS)
            sessionRef.current = session
            stepIdxRef.current = 0; passedRef.current = 0
            blinkCountRef.current = 0; blinkConsecRef.current = 0
            closeHoldRef.current = 0; fingerHoldRef.current = 0
            pitchBaseRef.current = null

            const needHand = session.some(c => c.category === 'hand')
            await loadModels(needHand)

            // Request camera permission explicitly before getUserMedia.
            // On Android WebView (APK), this triggers the native system permission dialog.
            // On browsers it's a no-op (permission is already requested by getUserMedia).
            if (navigator.permissions) {
                try {
                    const perm = await navigator.permissions.query({ name: 'camera' as PermissionName })
                    if (perm.state === 'denied') {
                        setLivenessState('failed')
                        setError('Camera access is blocked. Please go to Settings → App → Permissions and enable Camera, then try again.')
                        return
                    }
                } catch { /* Permissions API not available on this platform — proceed */ }
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
            })
            streamRef.current = stream

            setCurrentChallenge(session[0])
            setCurrentIdx(0)
            setProgress(0)
            setLivenessState('ready')

            await new Promise<void>(r => requestAnimationFrame(() => r()))
            await new Promise<void>(r => requestAnimationFrame(() => r()))
            const video = videoRef.current!
            video.srcObject = stream; await video.play()

            // start recording
            try {
                videoChunksRef.current = []
                const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
                const mr = new MediaRecorder(stream, { mimeType: mime })
                mr.ondataavailable = e => { if (e.data.size > 0) videoChunksRef.current.push(e.data) }
                mr.start(200); mediaRecorderRef.current = mr
            } catch { }

            await new Promise(r => setTimeout(r, 1500))
            setLivenessState('challenge')
            runStep(session[0], 0)
        } catch (err: any) {
            setLivenessState('failed')
            if (err.name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access in your browser/device settings and try again.')
            else if (err.name === 'NotFoundError') setError('No camera found on this device.')
            else setError(err.message || 'Could not start verification. Please try again.')
        }
    }

    // ─── Run one challenge step ───────────────────────────────────────────────
    const runStep = (ch: ActiveChallenge, idx: number) => {
        stepActiveRef.current = true
        blinkCountRef.current = 0; blinkConsecRef.current = 0
        closeHoldRef.current = 0; fingerHoldRef.current = 0
        waveHistRef.current = []; pitchBaseRef.current = null
        setProgress(0)

        // Timeout
        stepTimerRef.current = setTimeout(() => {
            if (!stepActiveRef.current) return
            stepActiveRef.current = false
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
            advanceStep(false, idx)
        }, ch.timeoutMs)

        {
            // Run ML inference at full 60fps so detection sensitivity matches desktop —
            // CLOSE_HOLD_FRAMES=25 = 416ms, FINGER_HOLD_FRAMES=12 = 200ms hold.
            // On native, only throttle REACT STATE UPDATES to 20fps (50ms) so the
            // UI doesn't jank from 60 re-renders/sec. Completion fires immediately.
            const isNative = (window as any).Capacitor?.isNativePlatform?.()
            const STATE_INTERVAL_MS = isNative ? 50 : 0
            let lastStateUpdate = 0
            const loop = (now: number) => {
                if (!stepActiveRef.current) return
                const ts = Math.floor(now)
                const video = videoRef.current
                if (!video) { rafRef.current = requestAnimationFrame(loop); return }
                try {
                    const face = faceLandmarkerRef.current?.detectForVideo(video, ts)
                    const lm: any[] | undefined = face?.faceLandmarks?.[0]

                    let hand: any[] | undefined
                    if (ch.category === 'hand' && handLandmarkerRef.current) {
                        const hResult = handLandmarkerRef.current.detectForVideo(video, ts)
                        hand = hResult?.landmarks?.[0]
                    }

                    const pct = detectChallenge(ch, lm, hand)

                    // Completion: fire immediately — don't wait for state batch
                    if (pct !== null && pct >= 100) {
                        if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
                        stepActiveRef.current = false
                        setProgress(100)
                        setFaceInFrame(!!(lm && lm.length > 0))
                        advanceStep(true, idx); return
                    }

                    // Throttle UI state updates to avoid excess re-renders on mobile
                    const shouldUpdate = now - lastStateUpdate >= STATE_INTERVAL_MS
                    if (shouldUpdate) {
                        lastStateUpdate = now
                        setFaceInFrame(!!(lm && lm.length > 0))
                        if (pct !== null) setProgress(Math.min(100, pct))
                    }
                } catch { }
                rafRef.current = requestAnimationFrame(loop)
            }
            rafRef.current = requestAnimationFrame(loop)
        }
    }

    // ─── Challenge detection logic ────────────────────────────────────────────
    const detectChallenge = (ch: ActiveChallenge, lm: any[] | undefined, hand: any[] | undefined): number | null => {
        if (ch.category === 'face') {
            if (!lm) return 0
            switch (ch.key) {
                case 'blink2': {
                    const ear = avgEAR(lm)
                    if (ear < BLINK_EAR) blinkConsecRef.current++
                    else { if (blinkConsecRef.current >= BLINK_FRAMES) blinkCountRef.current++; blinkConsecRef.current = 0 }
                    return (blinkCountRef.current / 2) * 100
                }
                case 'wink_left': {
                    if (winkLeft(lm)) closeHoldRef.current++; else closeHoldRef.current = 0
                    return (closeHoldRef.current / CLOSE_HOLD_FRAMES) * 100
                }
                case 'wink_right': {
                    if (winkRight(lm)) closeHoldRef.current++; else closeHoldRef.current = 0
                    return (closeHoldRef.current / CLOSE_HOLD_FRAMES) * 100
                }
                case 'close_eyes': {
                    const ear = avgEAR(lm)
                    if (ear < CLOSE_EAR) closeHoldRef.current++
                    else closeHoldRef.current = Math.max(0, closeHoldRef.current - 1)
                    return (closeHoldRef.current / CLOSE_HOLD_FRAMES) * 100
                }
                case 'look_left': { const y = computeYaw(lm); return Math.max(0, (-y / YAW_DEG) * 100) }
                case 'look_right': { const y = computeYaw(lm); return Math.max(0, (y / YAW_DEG) * 100) }
                case 'look_up': { const p = computePitch(lm); return Math.max(0, (-p / PITCH_THRESH) * 100) }
                case 'look_down': {
                    if (pitchBaseRef.current === null) { pitchBaseRef.current = computePitch(lm); return 0 }
                    return Math.max(0, ((computePitch(lm) - pitchBaseRef.current) / PITCH_THRESH) * 100)
                }
                case 'nod': {
                    if (pitchBaseRef.current === null) { pitchBaseRef.current = computePitch(lm); return 0 }
                    const delta = computePitch(lm) - pitchBaseRef.current
                    return Math.max(0, (delta / PITCH_THRESH) * 100)
                }
                case 'tilt_left': { const r = computeRoll(lm); return Math.max(0, (-r / ROLL_DEG) * 100) }
                case 'tilt_right': { const r = computeRoll(lm); return Math.max(0, (r / ROLL_DEG) * 100) }
                case 'smile': { return Math.max(0, ((smileRatio(lm) - 0.08) / (SMILE_THR - 0.08)) * 100) }
                case 'mouth_open': { return Math.max(0, ((mouthOpenRatio(lm) - 0.10) / (MOUTH_OPEN_THR - 0.10)) * 100) }
                case 'raise_brows': { return Math.max(0, (browsRaised(lm) / BROW_THR) * 100) }
                default: return 0
            }
        }

        if (ch.category === 'hand') {
            if (!hand) return 0
            const fingers = countFingers(hand)

            switch (ch.key) {
                case 'show_1': case 'show_2': case 'show_3': case 'show_4': case 'show_5': {
                    const target = parseInt(ch.key.split('_')[1])
                    const match = fingers === target
                    if (match) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'thumbs_up': {
                    if (isThumbUp(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'thumbs_down': {
                    if (isThumbDown(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'fist': {
                    if (isFist(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'open_palm': {
                    if (isOpenPalm(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'wave': {
                    waveHistRef.current.push(hand[9].x)
                    if (waveHistRef.current.length > 20) waveHistRef.current.shift()
                    const spread = Math.max(...waveHistRef.current) - Math.min(...waveHistRef.current)
                    return Math.max(0, (spread / 0.25) * 100)
                }
                case 'point_up': {
                    if (isPointUp(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'rock_on': {
                    if (isRockOn(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'call_me': {
                    if (isCallMe(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'ok_sign': {
                    if (isOkSign(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'l_shape': {
                    if (isLShape(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                case 'cross_fingers': {
                    if (isCrossedFingers(hand)) fingerHoldRef.current++; else fingerHoldRef.current = 0
                    return (fingerHoldRef.current / FINGER_HOLD_FRAMES) * 100
                }
                default: return 0
            }
        }
        return 0
    }

    // ─── Advance step ─────────────────────────────────────────────────────────
    const advanceStep = (passed: boolean, idx: number) => {
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        if (passed) passedRef.current++

        const nextIdx = idx + 1
        stepIdxRef.current = nextIdx

        if (nextIdx < sessionRef.current.length) {
            const next = sessionRef.current[nextIdx]
            setCurrentChallenge(next); setCurrentIdx(nextIdx); setProgress(0)
            setTimeout(() => runStep(next, nextIdx), 700)
        } else {
            if (passedRef.current >= PASS_THRESHOLD) finishLiveness()
            else {
                stopAll()
                setLivenessState('failed')
                setError(`Liveness failed: ${passedRef.current}/${SESSION_STEPS} challenges passed. Please try again in good lighting.`)
            }
        }
    }

    // ─── Finish + save ────────────────────────────────────────────────────────
    const finishLiveness = async () => {
        if (!user) return
        let videoBlob: Blob | null = null
        if (mediaRecorderRef.current?.state !== 'inactive') {
            mediaRecorderRef.current?.stop()
            await new Promise<void>(r => setTimeout(r, 300))
            if (videoChunksRef.current.length > 0)
                videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' })
            mediaRecorderRef.current = null
        }
        stopAll(); setLivenessState('passed')
        try {
            let videoUrl: string | undefined
            if (videoBlob) {
                try {
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
                    const { storage } = await import('@/lib/firebase')
                    const sr = ref(storage, `liveness-videos/${user.uid}/${Date.now()}.webm`)
                    const snap = await uploadBytes(sr, videoBlob, { contentType: 'video/webm' })
                    videoUrl = await getDownloadURL(snap.ref)
                } catch { }
            }
            await updateKycStatus(user.uid, 'liveness', videoUrl ? { livenessVideoUrl: videoUrl } : undefined)
            setSuccess('✅ Liveness verified!')
            setTimeout(() => { setSuccess(''); setPhase('digilocker') }, 1200)
        } catch { setError('Save failed. Please contact support.'); setLivenessState('idle') }
    }

    const retryLiveness = () => {
        stopAll(); setLivenessState('idle'); setProgress(0); setCurrentIdx(0); setError('')
    }

    // ─── Launch DigiLocker: synchronous click so popup isn't blocked ──────────
    // Token is already fetched; SDK button already rendered. Click it immediately
    // from within the user gesture — no async gap, browsers allow the popup.
    const launchDigiLocker = () => {
        const btn = document.querySelector('#sp-digilocker-btn button') as HTMLButtonElement | null
        if (!btn) { setError('DigiLocker not ready yet. Please wait a moment and try again.'); return }
        setDigilockerLaunching(true)
        setError('')
        btn.click()  // synchronous — user gesture is preserved → popup opens
    }

    const fetchAndComplete = async (clientId: string) => {
        if (!user) return
        setAadhaarFetching(true)
        await new Promise(r => setTimeout(r, 2000))
        let att = 0
        const poll = async (): Promise<void> => {
            try {
                const res = await fetch(`/api/kyc-aadhaar?clientId=${encodeURIComponent(clientId)}`)
                const data = await res.json()
                if (res.status === 202 || data.pending) {
                    att++
                    if (att < 12) { await new Promise(r => setTimeout(r, 2500)); return poll() }
                    // Timed out — Surepass kept returning 202 (user didn't authorize Aadhaar)
                    setError('❌ Aadhaar authorization not received. Please try again and authorize Aadhaar in DigiLocker.')
                    setSuccess(''); setNeedsRefresh(true); setPhase('digilocker'); return
                }
                if (res.status === 422 || data.missingAadhaar) {
                    setError('❌ Aadhaar not authorized. Please try and authorize Aadhaar in DigiLocker.')
                    setSuccess('')
                    setNeedsRefresh(true)
                    setPhase('digilocker')
                    return
                }
                if (!res.ok) { setError(data.error || 'Could not fetch Aadhaar.'); setSuccess(''); setNeedsRefresh(true); setPhase('digilocker'); return }
                if (!data.name && !data.maskedAadhaar) {
                    setError('❌ Incomplete data. Please try again.'); setSuccess('')
                    setNeedsRefresh(true); setPhase('digilocker'); return
                }
                await updateKycStatus(user.uid, 'aadhaar', {
                    name: data.name,
                    dob: data.dob,
                    gender: data.gender,
                    maskedAadhaar: data.maskedAadhaar,
                    address: data.address,
                    profileImage: data.profileImage,
                })
                if (data.aadhaarXmlContent) {
                    try {
                        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
                        const { storage } = await import('@/lib/firebase')
                        const ts = Date.now()

                        // 1️⃣  Upload XML (official signed document)
                        const xmlBlob = new Blob([data.aadhaarXmlContent], { type: 'application/xml' })
                        const xmlRef = ref(storage, `aadhaar-docs/${user.uid}/${ts}-aadhaar.xml`)
                        const xmlSnap = await uploadBytes(xmlRef, xmlBlob, { contentType: 'application/xml', customMetadata: { userId: user.uid, maskedAadhaar: data.maskedAadhaar || '' } })
                        await updateKycStatus(user.uid, 'aadhaar', { aadhaarDocUrl: await getDownloadURL(xmlSnap.ref) })

                        // 2️⃣  Upload PDF — prefer Surepass pre-built PDF, fall back to jspdf summary
                        try {
                            let pdfBlob: Blob | null = null
                            if (data.aadhaarPdfBase64) {
                                // Surepass returned their own pre-built PDF ✅
                                console.log('📄 Using Surepass pre-built PDF')
                                const bytes = Uint8Array.from(atob(data.aadhaarPdfBase64), c => c.charCodeAt(0))
                                pdfBlob = new Blob([bytes], { type: 'application/pdf' })
                            } else {
                                // Surepass didn't provide a PDF — generate a summary PDF with jspdf
                                console.info('📄 Surepass PDF not available — generating summary PDF')
                                const { jsPDF } = await import('jspdf')
                                const doc = new jsPDF({ unit: 'mm', format: 'a4' })
                                const PW = 210, M = 16
                                let y = M

                                doc.setFillColor(99, 58, 245)
                                doc.rect(0, 0, PW, 28, 'F')
                                doc.setTextColor(255, 255, 255)
                                doc.setFont('helvetica', 'bold'); doc.setFontSize(18)
                                doc.text('Aadhaar eKYC Summary', M, 12)
                                doc.setFontSize(9); doc.setFont('helvetica', 'normal')
                                doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, M, 21)
                                y = 38; doc.setTextColor(30, 30, 30)

                                if (data.profileImage) {
                                    try { doc.addImage(`data:image/jpeg;base64,${data.profileImage}`, 'JPEG', PW - M - 35, y - 4, 35, 42) } catch { }
                                }
                                const field = (label: string, value: string | null | undefined) => {
                                    if (!value) return
                                    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
                                    doc.text(label.toUpperCase(), M, y); y += 4
                                    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(20, 20, 20)
                                    doc.text(value, M, y); y += 8
                                }
                                field('Full Name', data.name)
                                field('Date of Birth', data.dob)
                                field('Gender', data.gender === 'M' ? 'Male' : data.gender === 'F' ? 'Female' : data.gender)
                                field('Masked Aadhaar', data.maskedAadhaar)
                                if (data.address) {
                                    y += 2
                                    doc.setDrawColor(220, 220, 220); doc.line(M, y, PW - M, y); y += 5
                                    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
                                    doc.text('ADDRESS', M, y); y += 4
                                    const a = data.address
                                    const addrParts = [a.house, a.street, a.loc, a.vtc, a.district, a.state, a.pincode, a.country].filter(Boolean).join(', ')
                                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(20, 20, 20)
                                    const lines = doc.splitTextToSize(addrParts, PW - M * 2 - 42) as string[]
                                    doc.text(lines, M, y); y += lines.length * 5 + 4
                                }
                                doc.setDrawColor(220, 220, 220); doc.line(M, y + 4, PW - M, y + 4)
                                doc.setFontSize(7); doc.setTextColor(150, 150, 150)
                                doc.text('This document is auto-generated from your DigiLocker Aadhaar eKYC data.', M, y + 10)
                                pdfBlob = doc.output('blob')
                            }
                            if (pdfBlob) {
                                const pdfRef = ref(storage, `aadhaar-pdf/${user.uid}/${ts}-aadhaar.pdf`)
                                const pdfSnap = await uploadBytes(pdfRef, pdfBlob, { contentType: 'application/pdf', customMetadata: { userId: user.uid } })
                                await updateKycStatus(user.uid, 'aadhaar', { aadhaarPdfUrl: await getDownloadURL(pdfSnap.ref) })
                            }
                        } catch (pdfErr) {
                            console.warn('⚠️ PDF upload failed (non-fatal):', pdfErr)
                        }
                    } catch { }
                }
                await updateKycStatus(user.uid, 'complete')
                setPhase('complete'); setSuccess('🎉 KYC complete!')
                setTimeout(() => router.replace('/onboarding/education'), 2000)
            } catch (e: any) {
                setError(e.message || 'Failed to complete verification.'); setSuccess('')
            } finally { setAadhaarFetching(false) }
        }
        poll()
    }

    // ─── UI ───────────────────────────────────────────────────────────────────
    if (authLoading || pageLoading) return (
        <div className="min-h-screen w-full flex items-center justify-center"
            style={{ background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))' }}>
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
        </div>
    )

    const STEP_LABELS = [{ id: 'liveness', label: 'Liveness' }, { id: 'digilocker', label: 'DigiLocker' }]
    const stepIdx = STEP_LABELS.findIndex(s => s.id === phase)
    const cLabel = currentChallenge ? getInstruction(currentChallenge as any) : ''

    return (
        <div className="min-h-screen w-full flex items-center justify-center px-4 py-12"
            style={{ background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))' }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">

                <div className="text-center mb-8">
                    <Link href="/"><Image src="/logo.jpg" alt="NeedYou" width={64} height={64} className="mx-auto rounded-2xl shadow-lg mb-4" /></Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Identity Verification</h1>

                </div>

                <div className="flex items-center justify-center gap-2 mb-8">
                    {STEP_LABELS.map((step, idx) => {
                        const done = idx < stepIdx || phase === 'complete'
                        const active = idx === stepIdx && phase !== 'complete'
                        return (
                            <div key={step.id} className="flex items-center">
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shadow transition-all
                    ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                                        {done ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                                    </div>
                                    <span className={`text-xs font-medium ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-gray-400'}`}>{step.label}</span>
                                </div>
                                {idx < STEP_LABELS.length - 1 && (
                                    <div className={`w-8 h-1 mx-2 rounded-full transition-all duration-500 ${done ? 'bg-green-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="bg-white/80 dark:bg-[#1c1c1c]/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700">

                    {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="mb-5 p-4 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl text-red-700 dark:text-red-300 text-sm flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span className="whitespace-pre-line">{error}</span>
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            className="mb-5 p-4 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-xl text-green-700 dark:text-green-300 text-sm flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /><span>{success}</span>
                        </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                        {phase === 'liveness' && (
                            <motion.div key="liveness" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">

                                <div className="text-center">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Face Liveness Check</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {livenessState === 'idle' && `${SESSION_STEPS} random challenges — face, hands & voice`}
                                        {livenessState === 'loading' && 'Loading AI models...'}
                                        {livenessState === 'ready' && 'Camera ready...'}
                                        {livenessState === 'challenge' && cLabel}
                                        {livenessState === 'passed' && '✅ Liveness verified!'}
                                        {livenessState === 'failed' && 'Verification failed'}
                                    </p>
                                </div>

                                {livenessState === 'challenge' && (
                                    <div className="flex justify-center gap-2">
                                        {Array.from({ length: SESSION_STEPS }).map((_, i) => (
                                            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${i < currentIdx ? 'bg-green-500' : i === currentIdx ? 'bg-blue-500 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                        ))}
                                    </div>
                                )}

                                {(livenessState === 'ready' || livenessState === 'challenge' || livenessState === 'passed') && (
                                    <div className="relative rounded-2xl overflow-hidden bg-gray-900" style={{ aspectRatio: '4/3' }}>
                                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className={`border-4 border-dashed rounded-full transition-all duration-300 ${faceInFrame ? 'border-green-400 shadow-[0_0_20px_rgba(74,222,128,0.5)]' : 'border-white/40'}`}
                                                style={{ width: '52%', height: '78%' }} />
                                        </div>

                                        {livenessState === 'ready' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                                <Loader2 className="w-10 h-10 animate-spin text-white" />
                                            </div>
                                        )}

                                        {livenessState === 'challenge' && (
                                            <div className="absolute bottom-3 left-3 right-3">
                                                <div className="bg-black/80 backdrop-blur-sm rounded-xl px-4 py-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs text-gray-400">Step {currentIdx + 1}/{SESSION_STEPS}</span>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentChallenge?.category === 'hand' ? 'bg-orange-500/30 text-orange-300' : 'bg-blue-500/30 text-blue-300'}`}>
                                                            {currentChallenge?.category?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <p className="text-white font-bold text-sm">{cLabel}</p>
                                                    <div className="mt-2 w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                                        <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.1 }}
                                                            className={`h-full rounded-full ${progress < 50 ? 'bg-yellow-400' : progress < 100 ? 'bg-orange-400' : 'bg-green-400'}`} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {livenessState === 'passed' && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-green-500/60">
                                                <CheckCircle className="w-20 h-20 text-white drop-shadow-lg" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {livenessState === 'loading' && (
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Loading AI models (face + hand + object)...</p>
                                        <p className="text-xs text-gray-400 mt-1">First load may take ~10 seconds</p>
                                    </div>
                                )}

                                {livenessState === 'idle' && (
                                    <div className="space-y-3">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                                            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                                                <li>Random face, hand & voice challenges each session</li>
                                                <li>Each challenge revealed only after the previous</li>
                                                <li>📱 Mobile phones in frame = instant fail</li>
                                                <li>Good lighting, face camera directly</li>
                                            </ul>
                                        </div>
                                        <button onClick={startLiveness}
                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
                                            <Camera className="w-6 h-6" /> Start Liveness Check
                                        </button>
                                    </div>
                                )}

                                {livenessState === 'failed' && (
                                    <button onClick={retryLiveness}
                                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2 text-lg">
                                        <RefreshCw className="w-5 h-5" /> Try Again
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {phase === 'digilocker' && (
                            <motion.div key="digilocker" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                                <div className="text-center">
                                    <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <ShieldCheck className="w-10 h-10 text-purple-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Verify with DigiLocker</h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Authorize your Aadhaar via DigiLocker</p>
                                </div>
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">⚠️ Important</p>
                                    <p className="text-xs text-amber-600 dark:text-amber-400">When DigiLocker opens, please select <strong>Aadhaar</strong>.</p>
                                </div>
                                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                                    <ul className="text-xs text-purple-600 dark:text-purple-300 space-y-1 list-disc list-inside">
                                        <li>Opens official DigiLocker portal</li>
                                        <li>Login with Aadhaar-linked mobile OTP</li>
                                        <li>Full Aadhaar number is never stored</li>
                                    </ul>
                                </div>
                                {aadhaarFetching ? (
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Fetching your documents...</p>
                                    </div>
                                ) : digilockerLaunching ? (
                                    <div className="space-y-3">
                                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Complete authorization in the DigiLocker window...</p>
                                        </div>
                                        <button onClick={() => { sdkCleanup.current?.(); setDigilockerLaunching(false); setError('') }}
                                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center gap-1">
                                            <RefreshCw className="w-4 h-4" /> Cancel
                                        </button>
                                    </div>
                                ) : !digilockerReady ? (
                                    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Preparing DigiLocker...</p>
                                    </div>
                                ) : needsRefresh ? (
                                    <div className="space-y-3">
                                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-center">
                                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">You did not authorize Aadhaar in DigiLocker.</p>
                                            <p className="text-xs text-red-500 dark:text-red-400 mt-1">Please refresh the page and try again. When DigiLocker opens, make sure to select and authorize <strong>Aadhaar</strong>.</p>
                                        </div>
                                        <button onClick={() => window.location.reload()}
                                            className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
                                            <RefreshCw className="w-5 h-5" /> Refresh Page &amp; Try Again
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={launchDigiLocker}
                                        className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg">
                                        <ShieldCheck className="w-6 h-6" /> Continue with DigiLocker <ArrowRight className="w-5 h-5" />
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {phase === 'complete' && (
                            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6 space-y-4">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                                    className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle className="w-14 h-14 text-green-500" />
                                </motion.div>
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">You&apos;re Verified!</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Setting up your profile...</p>
                                <Loader2 className="w-6 h-6 animate-spin text-green-500 mx-auto" />
                            </motion.div>
                        )}
                    </AnimatePresence>


                </div>

            </motion.div>
        </div>
    )
}

export default function VerifyKycPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen w-full flex items-center justify-center"
                style={{ background: 'linear-gradient(to bottom right, rgb(var(--gradient-from)), rgb(var(--gradient-via)), rgb(var(--gradient-to)))' }}>
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            </div>
        }>
            <VerifyKycContent />
        </Suspense>
    )
}
