// ─── Types ────────────────────────────────────────────────────────────────────
export type ChallengeCategory = 'face' | 'hand'

export interface ChallengeSpec {
    key: string
    label: string
    instruction: string
    category: ChallengeCategory
    timeoutMs: number
}

// ─── Face landmark helpers ────────────────────────────────────────────────────
function d2(a: any, b: any) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) }

export function earLeft(lm: any[]) {
    try { return (d2(lm[158], lm[144]) + d2(lm[157], lm[153])) / (2 * d2(lm[33], lm[133])) }
    catch { return 1 }
}
export function earRight(lm: any[]) {
    try { return (d2(lm[385], lm[380]) + d2(lm[384], lm[381])) / (2 * d2(lm[362], lm[263])) }
    catch { return 1 }
}
export function avgEAR(lm: any[]) { return (earLeft(lm) + earRight(lm)) / 2 }
export function winkLeft(lm: any[]) { return earLeft(lm) < 0.18 && earRight(lm) > 0.24 }
export function winkRight(lm: any[]) { return earRight(lm) < 0.18 && earLeft(lm) > 0.24 }

export function computeYaw(lm: any[]) {
    try {
        const nose = lm[4], lx = lm[234].x, rx = lm[454].x
        const fw = Math.abs(rx - lx)
        return fw > 0 ? ((nose.x - (lx + rx) / 2) / (fw / 2)) * 90 : 0
    } catch { return 0 }
}
export function computePitch(lm: any[]) {
    try {
        const nose = lm[4]
        const eyeMidY = (lm[159].y + lm[386].y) / 2
        const chinY = lm[152].y
        const faceH = Math.abs(chinY - eyeMidY)
        return faceH > 0 ? ((nose.y - eyeMidY) / faceH - 0.5) * 100 : 0
    } catch { return 0 }
}
export function computeRoll(lm: any[]) {
    try {
        const l = lm[33], r = lm[263]
        return Math.atan2(r.y - l.y, r.x - l.x) * (180 / Math.PI)
    } catch { return 0 }
}
export function smileRatio(lm: any[]) {
    try { return d2(lm[13], lm[14]) / d2(lm[61], lm[291]) } catch { return 0 }
}
export function mouthOpenRatio(lm: any[]) {
    try { return d2(lm[13], lm[14]) / d2(lm[61], lm[291]) } catch { return 0 }
}
export function browsRaised(lm: any[]) {
    try {
        const lDist = lm[159].y - lm[70].y
        const rDist = lm[386].y - lm[300].y
        return (lDist + rDist) / 2
    } catch { return 0 }
}

// ─── Hand landmark helpers ────────────────────────────────────────────────────
export interface HandData { landmarks: any[]; handedness: string }

function tipAbovePip(lm: any[], tip: number, pip: number) { return lm[tip].y < lm[pip].y }
function thumbExtended(lm: any[]) { return Math.abs(lm[4].x - lm[2].x) > 0.06 }
function thumbCurled(lm: any[]) { return Math.abs(lm[4].x - lm[2].x) < 0.045 }

export function countFingers(lm: any[]): number {
    let n = 0
    if (tipAbovePip(lm, 8, 6)) n++
    if (tipAbovePip(lm, 12, 10)) n++
    if (tipAbovePip(lm, 16, 14)) n++
    if (tipAbovePip(lm, 20, 18)) n++
    if (thumbExtended(lm)) n++
    return n
}

export function isThumbUp(lm: any[]): boolean {
    return lm[4].y < lm[3].y && lm[4].y < lm[2].y
        && !tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
}
export function isThumbDown(lm: any[]): boolean {
    return lm[4].y > lm[3].y && lm[4].y > lm[2].y
        && !tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
}
export function isFist(lm: any[]): boolean {
    return !tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
        && thumbCurled(lm)
}
export function isOpenPalm(lm: any[]): boolean { return countFingers(lm) >= 4 }

/** ✌️ Peace — index + middle up, ring + pinky down, thumb curled */
export function isPeace(lm: any[]): boolean {
    return tipAbovePip(lm, 8, 6) && tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
        && thumbCurled(lm)
}

/** 🤘 Rock on / horns — index + pinky up, middle + ring down */
export function isRockOn(lm: any[]): boolean {
    return tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && tipAbovePip(lm, 20, 18)
}

/** 🤙 Call me — thumb + pinky extended, index + middle + ring curled */
export function isCallMe(lm: any[]): boolean {
    return thumbExtended(lm) && tipAbovePip(lm, 20, 18)
        && !tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14)
}

/** 👆 Point up — index only up, others curled */
export function isPointUp(lm: any[]): boolean {
    return tipAbovePip(lm, 8, 6) && !tipAbovePip(lm, 12, 10)
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
        && thumbCurled(lm)
}

/** 🤌 OK sign — thumb tip near index tip, other 3 fingers extended */
export function isOkSign(lm: any[]): boolean {
    const palmW = d2(lm[5], lm[17])
    const tipDist = d2(lm[4], lm[8])
    return tipDist < palmW * 0.35
        && tipAbovePip(lm, 12, 10) && tipAbovePip(lm, 16, 14) && tipAbovePip(lm, 20, 18)
}

/** 🤞 Crossed fingers — index over middle (x-axis cross) */
export function isCrossedFingers(lm: any[]): boolean {
    return tipAbovePip(lm, 8, 6) && tipAbovePip(lm, 12, 10)
        && Math.abs(lm[8].x - lm[12].x) < 0.04  // tips very close horizontally
        && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
}

/** L-shape — index up + thumb out, other 3 curled */
export function isLShape(lm: any[]): boolean {
    return tipAbovePip(lm, 8, 6) && thumbExtended(lm)
        && !tipAbovePip(lm, 12, 10) && !tipAbovePip(lm, 16, 14) && !tipAbovePip(lm, 20, 18)
}

// ─── Challenge pool ───────────────────────────────────────────────────────────
export const CHALLENGE_POOL: ChallengeSpec[] = [
    // ── Face (12) ─────────────────────────────────────────────────────────────
    { key: 'blink2', label: 'BLINK TWICE', instruction: 'Blink both eyes twice', category: 'face', timeoutMs: 30000 },
    { key: 'look_left', label: 'LOOK LEFT', instruction: 'Turn your head to the LEFT', category: 'face', timeoutMs: 30000 },
    { key: 'look_right', label: 'LOOK RIGHT', instruction: 'Turn your head to the RIGHT', category: 'face', timeoutMs: 30000 },
    { key: 'look_up', label: 'LOOK UP', instruction: 'Tilt your head UP toward the ceiling', category: 'face', timeoutMs: 30000 },
    { key: 'look_down', label: 'LOOK DOWN', instruction: 'Tilt your head DOWN toward the floor', category: 'face', timeoutMs: 30000 },
    { key: 'tilt_left', label: 'TILT LEFT', instruction: 'Tilt your head to your LEFT shoulder', category: 'face', timeoutMs: 30000 },
    { key: 'tilt_right', label: 'TILT RIGHT', instruction: 'Tilt your head to your RIGHT shoulder', category: 'face', timeoutMs: 30000 },
    { key: 'smile', label: 'SMILE', instruction: 'Give a wide natural SMILE', category: 'face', timeoutMs: 30000 },
    { key: 'mouth_open', label: 'OPEN MOUTH', instruction: 'Open your mouth WIDE (like saying "Ahh")', category: 'face', timeoutMs: 30000 },
    { key: 'raise_brows', label: 'RAISE EYEBROWS', instruction: 'Raise your EYEBROWS as high as you can', category: 'face', timeoutMs: 30000 },
    { key: 'nod', label: 'NOD', instruction: 'NOD your head slowly downward', category: 'face', timeoutMs: 30000 },
    { key: 'close_eyes', label: 'CLOSE EYES', instruction: 'Close BOTH EYES and hold for 1 second', category: 'face', timeoutMs: 30000 },
    { key: 'wink_left', label: 'WINK LEFT EYE', instruction: 'WINK your LEFT eye (keep right eye open)', category: 'face', timeoutMs: 30000 },
    { key: 'wink_right', label: 'WINK RIGHT EYE', instruction: 'WINK your RIGHT eye (keep left eye open)', category: 'face', timeoutMs: 30000 },

    // ── Hand (16) ─────────────────────────────────────────────────────────────
    { key: 'show_1', label: '☝️ 1 FINGER', instruction: 'Hold up 1 finger (index) in front of camera', category: 'hand', timeoutMs: 30000 },
    { key: 'show_2', label: '✌️ 2 FINGERS', instruction: 'Hold up 2 fingers — peace sign ✌️', category: 'hand', timeoutMs: 30000 },
    { key: 'show_3', label: '3 FINGERS', instruction: 'Hold up 3 fingers', category: 'hand', timeoutMs: 30000 },
    { key: 'show_4', label: '4 FINGERS', instruction: 'Hold up 4 fingers', category: 'hand', timeoutMs: 30000 },
    { key: 'show_5', label: '🖐️ OPEN HAND', instruction: 'Show your open hand — all 5 fingers', category: 'hand', timeoutMs: 30000 },
    { key: 'thumbs_up', label: '👍 THUMBS UP', instruction: 'Give a THUMBS UP to the camera', category: 'hand', timeoutMs: 30000 },
    { key: 'thumbs_down', label: '👎 THUMBS DOWN', instruction: 'Point THUMBS DOWN to the camera', category: 'hand', timeoutMs: 30000 },
    { key: 'fist', label: '✊ FIST', instruction: 'Make a tight FIST and hold it up', category: 'hand', timeoutMs: 30000 },
    { key: 'open_palm', label: '🤚 SHOW PALM', instruction: 'Show your OPEN PALM flat to the camera', category: 'hand', timeoutMs: 30000 },
    { key: 'wave', label: '👋 WAVE', instruction: 'WAVE your hand side-to-side at the camera', category: 'hand', timeoutMs: 30000 },
    { key: 'point_up', label: '☝️ POINT UP', instruction: 'Point ONE finger straight UP (index only)', category: 'hand', timeoutMs: 30000 },
    { key: 'rock_on', label: '🤘 ROCK ON', instruction: 'Make the rock-on sign 🤘 (index + pinky)', category: 'hand', timeoutMs: 30000 },
    { key: 'call_me', label: '🤙 CALL ME', instruction: 'Show the call-me sign 🤙 (thumb + pinky)', category: 'hand', timeoutMs: 30000 },
    { key: 'ok_sign', label: '👌 OK SIGN', instruction: 'Make the OK sign 👌 (thumb + index circle)', category: 'hand', timeoutMs: 30000 },
    { key: 'l_shape', label: '🔫 L-SHAPE', instruction: 'Make an L-shape with thumb + index finger', category: 'hand', timeoutMs: 30000 },
    { key: 'cross_fingers', label: '🤞 CROSS FINGERS', instruction: 'Cross your index + middle fingers 🤞', category: 'hand', timeoutMs: 30000 },
]

/** Pick N random challenges (guarantee at least 1 face + 1 hand) */
export function pickChallenges(n: number): ChallengeSpec[] {
    const face = CHALLENGE_POOL.filter(c => c.category === 'face').sort(() => Math.random() - 0.5)
    const hand = CHALLENGE_POOL.filter(c => c.category === 'hand').sort(() => Math.random() - 0.5)
    const picked: ChallengeSpec[] = [face[0], hand[0]]
    const rest = [...face.slice(1), ...hand.slice(1)].sort(() => Math.random() - 0.5)
    while (picked.length < n && rest.length > 0) picked.push(rest.shift()!)
    return picked.sort(() => Math.random() - 0.5)
}

export function getInstruction(c: ChallengeSpec): string { return c.instruction }
