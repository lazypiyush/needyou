'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, X, CheckCircle, XCircle, Loader2, Receipt, IndianRupee, AlertCircle, Download } from 'lucide-react'

export interface BillItem {
    reason: string
    amount: number
}

export interface Bill {
    items: BillItem[]
    total: number
    createdAt: number
}

interface JobBillModalProps {
    /** 'create' = worker filling bill | 'review' = client accept/reject | 'view' = read-only | 'paid' = completed receipt with PDF */
    mode: 'create' | 'review' | 'view' | 'paid'
    isDark: boolean
    onClose: () => void

    // create mode
    onSubmitBill?: (items: BillItem[], total: number) => Promise<void>

    // review mode
    onAccept?: () => Promise<void>
    onReject?: () => Promise<void>

    // shared: existing bill data
    bill?: Bill | null
    billStatus?: 'pending_review' | 'accepted' | 'rejected' | null
    billRejectedAt?: number | null
    workerName?: string     // shown on client review mode
    jobTitle?: string

    // paid mode extras
    clientName?: string
    paymentId?: string
    paidAt?: number
}

function ReceiptLine({ item, isDark }: { item: BillItem; isDark: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3 py-2.5">
            <span className="text-sm flex-1" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                {item.reason}
            </span>
            <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: isDark ? '#fff' : '#111827' }}>
                ₹{item.amount.toLocaleString('en-IN')}
            </span>
        </div>
    )
}

function DashedDivider({ isDark }: { isDark: boolean }) {
    return (
        <div
            className="my-3 border-t border-dashed"
            style={{ borderColor: isDark ? '#404040' : '#d1d5db' }}
        />
    )
}

function ReceiptHeader({ jobTitle, isDark }: { jobTitle?: string; isDark: boolean }) {
    const bg = isDark ? '#1a1a1a' : '#fff'
    const border = isDark ? '#2a2a2a' : '#e5e7eb'
    return (
        <div className="text-center pb-3" style={{ borderBottom: `1px dashed ${border}` }}>
            <div className="w-10 h-10 mx-auto mb-2 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Receipt className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
                NeedYou Job Bill
            </p>
            {jobTitle && (
                <p className="text-sm font-semibold mt-1 line-clamp-1" style={{ color: isDark ? '#e5e7eb' : '#111827' }}>
                    {jobTitle}
                </p>
            )}
            <p className="text-xs mt-1" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
        </div>
    )
}

export default function JobBillModal({
    mode,
    isDark,
    onClose,
    onSubmitBill,
    onAccept,
    onReject,
    bill,
    billStatus,
    billRejectedAt,
    workerName,
    jobTitle,
    clientName,
    paymentId,
    paidAt,
}: JobBillModalProps) {
    // create mode state
    const [items, setItems] = useState<BillItem[]>(
        bill && mode === 'create' ? [] : [] // always fresh when creating
    )
    const [submitting, setSubmitting] = useState(false)
    const [acceptLoading, setAcceptLoading] = useState(false)
    const [rejectLoading, setRejectLoading] = useState(false)
    const [itemErrors, setItemErrors] = useState<string[]>([])
    const [globalError, setGlobalError] = useState('')

    const bg = isDark ? '#141414' : '#fafafa'
    const cardBg = isDark ? '#1e1e1e' : '#fff'
    const border = isDark ? '#2a2a2a' : '#e5e7eb'
    const textPri = isDark ? '#fff' : '#111827'
    const textSec = isDark ? '#9ca3af' : '#6b7280'

    const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)

    // ── PDF Export (APK-compatible: uses Android native print dialog) ───────────
    const exportToPDF = () => {
        const win = window.open('', '_blank', 'width=820,height=960')
        if (!win) return
        const rows = (bill?.items ?? []).map(it =>
            `<tr><td style="padding:9px 0;border-bottom:1px solid #e5e7eb;color:#374151;font-size:14px">${it.reason}</td>
             <td style="padding:9px 0;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;font-size:14px;color:#111827">\u20b9${it.amount.toLocaleString('en-IN')}</td></tr>`
        ).join('')
        const dateStr = paidAt ? new Date(paidAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })
        const timeStr = paidAt ? new Date(paidAt).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : ''
        win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>NeedYou – Job Receipt</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f5f7;padding:32px 16px;color:#111827}.card{max-width:580px;margin:0 auto;background:#fff;border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.10);overflow:hidden}.hd{background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:36px 32px;text-align:center;color:#fff}.hd h1{font-size:30px;font-weight:900;letter-spacing:.04em}.hd p{font-size:13px;opacity:.85;margin-top:5px}.paid-pill{display:inline-block;margin-top:14px;background:rgba(255,255,255,.22);border-radius:50px;padding:5px 20px;font-size:11px;font-weight:800;letter-spacing:.15em}.body{padding:28px 32px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:26px}.meta-cell{background:#f9fafb;border-radius:12px;padding:12px 14px}.meta-cell.full{grid-column:1/-1}.meta-cell label{display:block;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px}.meta-cell p{font-size:14px;font-weight:600;color:#111827}.sec-label{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px}table{width:100%;border-collapse:collapse}.total-row{display:flex;justify-content:space-between;align-items:center;padding-top:16px;margin-top:12px;border-top:2px solid #4f46e5}.total-label{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280}.total-amt{font-size:30px;font-weight:900;color:#4f46e5}.ok-pill{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;background:#ecfdf5;border:1.5px solid #6ee7b7;border-radius:50px;padding:8px 20px;font-size:13px;font-weight:700;color:#059669}.ft{background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;font-size:11px;color:#9ca3af}@media print{body{padding:0;background:#fff}.card{border-radius:0;box-shadow:none}}</style></head>
<body><div class="card">
<div class="hd"><h1>NeedYou</h1><p>Job Payment Receipt</p><div class="paid-pill">&#10022; PAID &#10022;</div></div>
<div class="body">
<div class="meta-grid">
  <div class="meta-cell"><label>Job</label><p>${jobTitle ?? '–'}</p></div>
  <div class="meta-cell"><label>Date</label><p>${dateStr}${timeStr ? ' · ' + timeStr : ''}</p></div>
  ${clientName ? `<div class="meta-cell"><label>Client</label><p>${clientName}</p></div>` : ''}
  ${workerName ? `<div class="meta-cell"><label>Service Provider</label><p>${workerName}</p></div>` : ''}
  ${paymentId ? `<div class="meta-cell full"><label>Payment Reference</label><p style="font-family:monospace;font-size:12px;word-break:break-all">${paymentId}</p></div>` : ''}
</div>
<p class="sec-label">Bill Details</p>
<table><tbody>${rows}</tbody></table>
<div class="total-row"><span class="total-label">Total Paid</span><span class="total-amt">&#8377;${(bill?.total ?? 0).toLocaleString('en-IN')}</span></div>
<div class="ok-pill">&#10003; Payment Complete &nbsp;&mdash;&nbsp; Amount credited to service provider</div>
</div>
<div class="ft"><p>Generated by NeedYou Platform &nbsp;&bull;&nbsp; ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p><p style="margin-top:4px">Computer-generated receipt &bull; No signature required</p></div>
</div><script>window.onload=()=>{setTimeout(()=>window.print(),400)}<\/script></body></html>`)
        win.document.close()
    }
    const addItem = () => setItems(prev => [...prev, { reason: '', amount: 0 }])

    const updateItem = (idx: number, field: keyof BillItem, value: string | number) => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
        setItemErrors(prev => { const e = [...prev]; e[idx] = ''; return e })
    }

    const removeItem = (idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx))
        setItemErrors(prev => prev.filter((_, i) => i !== idx))
    }

    const validateAndSubmit = async () => {
        setGlobalError('')
        if (items.length === 0) { setGlobalError('Add at least one item.'); return }

        const errors = items.map(it => {
            if (!it.reason.trim()) return 'Reason required'
            if (!it.amount || Number(it.amount) <= 0) return 'Amount must be > ₹0'
            return ''
        })
        setItemErrors(errors)
        if (errors.some(Boolean)) return

        if (total <= 0) { setGlobalError('Total must be greater than ₹0'); return }

        setSubmitting(true)
        try {
            await onSubmitBill?.(items, total)
        } finally {
            setSubmitting(false)
        }
    }

    const handleAccept = async () => {
        setAcceptLoading(true)
        try { await onAccept?.() } finally { setAcceptLoading(false) }
    }

    const handleReject = async () => {
        if (!confirm('Reject this bill? The worker will be notified to create a new one.')) return
        setRejectLoading(true)
        try { await onReject?.() } finally { setRejectLoading(false) }
    }

    return (
        <div className="fixed inset-0 z-[99999] flex items-end md:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <motion.div
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 60 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="w-full md:max-w-sm rounded-t-3xl md:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
                style={{ backgroundColor: bg, maxHeight: '88dvh', border: `1px solid ${border}` }}
            >
                {/* Close button */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2 flex-shrink-0">
                    <p className="text-base font-bold" style={{ color: textPri }}>
                        {mode === 'create' ? '🧾 Create Bill' : mode === 'review' ? '📋 Review Bill' : mode === 'paid' ? '✅ Payment Receipt' : '🧾 Bill Receipt'}
                    </p>
                    <button onClick={onClose} className="p-1.5 rounded-full transition-colors hover:bg-gray-200/20">
                        <X className="w-5 h-5" style={{ color: textSec }} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 px-5 pb-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
                    {/* Rejection banner */}
                    {billStatus === 'rejected' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3"
                            style={{ background: isDark ? '#3a0000' : '#fff0f0', border: `1px solid ${isDark ? '#7f1d1d' : '#fca5a5'}` }}>
                            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                Client rejected this bill
                                {billRejectedAt ? ` · ${new Date(billRejectedAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}` : ''}
                            </p>
                        </div>
                    )}

                    {/* Pending review banner */}
                    {billStatus === 'pending_review' && mode === 'view' && (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-3"
                            style={{ background: isDark ? '#1a1a00' : '#fefce8', border: `1px solid ${isDark ? '#713f12' : '#fde68a'}` }}>
                            <Loader2 className="w-4 h-4 text-yellow-500 animate-spin flex-shrink-0" />
                            <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                                Waiting for client to review…
                            </p>
                        </div>
                    )}

                    {/* Review mode header — show worker name */}
                    {mode === 'review' && workerName && (
                        <p className="text-xs text-center mb-3" style={{ color: textSec }}>
                            Bill submitted by <span className="font-semibold" style={{ color: textPri }}>{workerName}</span>
                        </p>
                    )}

                    {/* ── RECEIPT PAPER ── */}
                    <div
                        className="rounded-2xl p-4 shadow-inner"
                        style={{ backgroundColor: cardBg, border: `1px solid ${border}` }}
                    >
                        <ReceiptHeader jobTitle={jobTitle} isDark={isDark} />

                        {/* CREATE MODE — editable items */}
                        {mode === 'create' && (
                            <div className="mt-3 space-y-2">
                                <AnimatePresence>
                                    {items.map((item, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="flex items-start gap-2"
                                        >
                                            <div className="flex-1 space-y-1">
                                                <input
                                                    type="text"
                                                    inputMode="text"
                                                    placeholder="Reason (e.g. Labour charges)"
                                                    value={item.reason}
                                                    onChange={e => updateItem(idx, 'reason', e.target.value)}
                                                    className="w-full px-3 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500"
                                                    style={{ backgroundColor: isDark ? '#2a2a2a' : '#f9fafb', borderColor: itemErrors[idx] && !item.reason.trim() ? '#ef4444' : border, color: textPri, fontSize: 16 }}
                                                />
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    placeholder="Amount (₹)"
                                                    value={item.amount || ''}
                                                    onChange={e => updateItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2.5 rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500"
                                                    style={{ backgroundColor: isDark ? '#2a2a2a' : '#f9fafb', borderColor: itemErrors[idx] && (!item.amount || item.amount <= 0) ? '#ef4444' : border, color: textPri, fontSize: 16 }}
                                                />
                                                {itemErrors[idx] && (
                                                    <p className="text-xs text-red-500 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />{itemErrors[idx]}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => removeItem(idx)}
                                                className="mt-1 rounded-xl text-red-400 transition-colors flex-shrink-0 flex items-center justify-center"
                                                style={{ minWidth: 44, minHeight: 44 }}
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                <button
                                    onClick={addItem}
                                    className="w-full rounded-xl border-2 border-dashed text-sm font-medium flex items-center justify-center gap-1 transition-colors active:opacity-70"
                                    style={{ borderColor: border, color: textSec, minHeight: 44, padding: '10px 0' }}
                                >
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>
                        )}

                        {/* VIEW / REVIEW MODE — read-only items */}
                        {(mode === 'view' || mode === 'review') && bill && (
                            <div className="mt-3">
                                {bill.items.map((item, idx) => (
                                    <div key={idx}>
                                        <ReceiptLine item={item} isDark={isDark} />
                                        {idx < bill.items.length - 1 && (
                                            <div style={{ borderTop: `1px dashed ${border}` }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* No items yet */}
                        {mode !== 'create' && !bill?.items?.length && (
                            <p className="text-sm text-center py-4" style={{ color: textSec }}>No items</p>
                        )}

                        <DashedDivider isDark={isDark} />

                        {/* Total row */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold uppercase tracking-wide" style={{ color: textSec }}>Total</span>
                            <span className="text-xl font-black" style={{ color: isDark ? '#a78bfa' : '#6d28d9' }}>
                                ₹{(mode === 'create' ? total : bill?.total ?? 0).toLocaleString('en-IN')}
                            </span>
                        </div>

                        {/* Paid mode: payment metadata */}
                        {mode === 'paid' && (
                            <div className="mt-3 p-3 rounded-xl space-y-2" style={{ background: isDark ? '#0d2212' : '#f0fdf4', border: '1px solid rgba(16,185,129,0.35)' }}>
                                <div className="flex items-center gap-2 mb-1">
                                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Payment Completed</span>
                                </div>
                                {clientName && (
                                    <div className="flex justify-between text-xs" style={{ color: textSec }}>
                                        <span>Client</span><span className="font-semibold" style={{ color: textPri }}>{clientName}</span>
                                    </div>
                                )}
                                {workerName && (
                                    <div className="flex justify-between text-xs" style={{ color: textSec }}>
                                        <span>Service Provider</span><span className="font-semibold" style={{ color: textPri }}>{workerName}</span>
                                    </div>
                                )}
                                {paidAt && (
                                    <div className="flex justify-between text-xs" style={{ color: textSec }}>
                                        <span>Paid on</span><span className="font-semibold" style={{ color: textPri }}>{new Date(paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                    </div>
                                )}
                                {paymentId && (
                                    <div className="flex justify-between text-xs gap-3" style={{ color: textSec }}>
                                        <span className="flex-shrink-0">Payment ID</span>
                                        <span className="font-mono text-[11px] truncate" style={{ color: textPri }}>{paymentId}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Perforated bottom effect */}
                        <DashedDivider isDark={isDark} />
                        <p className="text-center text-[10px] tracking-widest uppercase" style={{ color: isDark ? '#404040' : '#d1d5db' }}>
                            ✦ NeedYou Platform ✦
                        </p>
                    </div>

                    {/* ── ACTION BUTTONS ── */}
                    <div className="mt-4 space-y-2">
                        {globalError && (
                            <p className="text-sm text-red-500 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {globalError}
                            </p>
                        )}

                        {mode === 'create' && (
                            <button
                                onClick={validateAndSubmit}
                                disabled={submitting || items.length === 0 || total <= 0}
                                className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                            >
                                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : <><Receipt className="w-4 h-4" /> Submit Bill</>}
                            </button>
                        )}

                        {mode === 'review' && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={handleReject}
                                    disabled={rejectLoading || acceptLoading}
                                    className="py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                                    style={{ background: isDark ? '#2a0000' : '#fff0f0', color: '#ef4444', border: '1px solid #ef4444' }}
                                >
                                    {rejectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                    Reject
                                </button>
                                <button
                                    onClick={handleAccept}
                                    disabled={acceptLoading || rejectLoading}
                                    className="py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                >
                                    {acceptLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><CheckCircle className="w-4 h-4" /> Accept & Pay</>}
                                </button>
                            </div>
                        )}

                        {mode === 'paid' && (
                            <button
                                onClick={exportToPDF}
                                className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                            >
                                <Download className="w-4 h-4" /> Download Receipt (PDF)
                            </button>
                        )}

                        {mode === 'view' && billStatus === 'rejected' && (
                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
                            >
                                Create New Bill
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="w-full py-2.5 rounded-xl font-semibold text-sm border transition-colors"
                            style={{ borderColor: border, color: textSec }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
