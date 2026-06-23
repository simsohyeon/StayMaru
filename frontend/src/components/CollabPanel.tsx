import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import QRCode from 'qrcode'
import clsx from 'clsx'
import type { Course } from '@/types/domain'
import { useCollab } from '@/stores/collab'
import { isCollabConfigured } from '@/lib/supabase'
import { toast } from '@/stores/toasts'

/**
 * 코스 실시간 협업 패널 — 로그인 없이 "코스 키(방 코드)" 하나로 친구와 같은 코스를 CRUD.
 *
 * 상태:
 *  - 미설정(Supabase env 없음): 기존 URL 링크 복사 폴백만 노출.
 *  - 비협업 코스: [코스 키 만들기] + [친구 코스 키로 참여] + 닉네임.
 *  - 협업 코스: 코스 키(복사/QR) + 기여자 + 실시간 접속자 + [나가기].
 */
export default function CollabPanel({ course, shareUrl }: { course: Course; shareUrl: string }) {
  const { t } = useTranslation()
  const me = useCollab((s) => s.me)
  const code = useCollab((s) => s.code)
  const status = useCollab((s) => s.status)
  const peers = useCollab((s) => s.peers)
  const setNickname = useCollab((s) => s.setNickname)
  const createRoom = useCollab((s) => s.createRoom)
  const joinRoom = useCollab((s) => s.joinRoom)
  const leaveRoom = useCollab((s) => s.leaveRoom)

  const configured = isCollabConfigured()
  const activeCode = course.collabCode ?? code
  const isLive = Boolean(activeCode) && status === 'live'

  const [nameDraft, setNameDraft] = useState(me.name)
  const [joinDraft, setJoinDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrUrl, setQrUrl] = useState<string>()

  // 코스 키 → 참여 링크 QR 생성
  useEffect(() => {
    if (!showQr || !activeCode) return
    const joinUrl = `${location.origin}/join/${activeCode}`
    void QRCode.toDataURL(joinUrl, { margin: 1, width: 220, color: { dark: '#1c1b18', light: '#ffffff' } })
      .then(setQrUrl)
      .catch(() => setQrUrl(undefined))
  }, [showQr, activeCode])

  // ── 미설정 폴백 — 기존 읽기전용 링크 공유 ──
  if (!configured) {
    return (
      <section className="card-pad space-y-3">
        <p className="eyebrow">{t('collab.eyebrow')}</p>
        <p className="text-body-sm text-body break-keep">{t('collab.unconfigured')}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            void navigator.clipboard.writeText(shareUrl).then(
              () => toast(t('place.linkCopied'), { type: 'success' }),
              () => toast(t('share.failed'), { type: 'error' }),
            )
          }}
        >
          🔗 {t('collab.copyLink')}
        </button>
      </section>
    )
  }

  function ensureName(): boolean {
    if (me.name.trim()) return true
    const n = nameDraft.trim()
    if (!n) {
      toast(t('collab.nameRequired'), { type: 'info' })
      return false
    }
    setNickname(n)
    return true
  }

  async function handleCreate() {
    if (busy || !ensureName()) return
    setBusy(true)
    try {
      const { result, code: newCode } = await createRoom(course)
      if (result === 'ok' && newCode) {
        await copyCode(newCode)
        toast(t('collab.created'), { type: 'success', duration: 4000 })
      } else {
        toast(t('collab.createFailed'), { type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (busy || !ensureName()) return
    const raw = joinDraft.trim()
    if (!raw) return
    setBusy(true)
    try {
      const result = await joinRoom(raw)
      if (result === 'ok') {
        setJoinDraft('')
        toast(t('collab.joined'), { type: 'success' })
      } else if (result === 'not-found') {
        toast(t('collab.notFound'), { type: 'error' })
      } else {
        toast(t('collab.joinFailed'), { type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  async function copyCode(c: string) {
    try {
      await navigator.clipboard.writeText(c)
      toast(t('collab.codeCopied', { code: c }), { type: 'success' })
    } catch {
      toast(t('share.failed'), { type: 'error' })
    }
  }

  const contributors = course.contributors ?? []

  return (
    <section className="card-pad space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="eyebrow">{t('collab.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink">{t('collab.title')}</h2>
          <p className="mt-2 text-caption text-muted max-w-md break-keep">{t('collab.subtitle')}</p>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
            {t('collab.live')}
          </span>
        )}
      </header>

      {/* 닉네임 — 협업 식별용(로그인 아님) */}
      <div>
        <label className="eyebrow block text-muted-soft">{t('collab.nickname')}</label>
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder={t('collab.nicknamePlaceholder')}
            value={nameDraft}
            maxLength={16}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && setNickname(nameDraft)}
          />
          <span
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md font-display text-lg text-white"
            style={{ backgroundColor: me.color }}
            aria-hidden
          >
            {(nameDraft.trim() || '?')[0].toUpperCase()}
          </span>
        </div>
      </div>

      {activeCode ? (
        // ── 협업 중 — 코스 키 노출 ──
        <div className="space-y-4">
          <div className="surface-pane">
            <p className="eyebrow text-muted-soft">{t('collab.courseKey')}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <code className="select-all font-mono text-display-sm tracking-[0.2em] text-ink">
                {activeCode}
              </code>
              <button type="button" className="chip" onClick={() => void copyCode(activeCode)}>
                📋 {t('collab.copyKey')}
              </button>
              <button type="button" className="chip" onClick={() => setShowQr((v) => !v)}>
                ▦ QR
              </button>
            </div>
            <p className="mt-2 text-caption text-muted-soft break-keep">{t('collab.keyHint')}</p>
            {showQr && qrUrl && (
              <img
                src={qrUrl}
                alt={t('collab.qrAlt')}
                className="mt-3 rounded-md border border-hairline bg-white p-2"
                width={140}
                height={140}
              />
            )}
          </div>

          {/* 기여자 + 실시간 접속자 */}
          <div>
            <p className="eyebrow text-muted-soft">
              {t('collab.contributors', { count: contributors.length })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {contributors.map((c) => {
                const online = peers.includes(c.name)
                return (
                  <span
                    key={c.id}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-medium',
                      online ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-hairline bg-card text-body',
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                    {c.name || t('collab.anon')}
                    {c.id === me.id && ` (${t('collab.you')})`}
                    {online && <span className="text-emerald-500" aria-hidden>●</span>}
                  </span>
                )
              })}
            </div>
          </div>

          <button type="button" className="btn-text text-muted" onClick={leaveRoom}>
            {t('collab.leave')}
          </button>
        </div>
      ) : (
        // ── 비협업 — 만들기 / 참여 ──
        <div className="space-y-4">
          <button
            type="button"
            className="btn-download w-full disabled:opacity-50"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            🔑 {t('collab.create')}
          </button>

          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-soft">
              {t('collab.or')}
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <div>
            <label className="eyebrow block text-muted-soft">{t('collab.joinLabel')}</label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                className="input flex-1 font-mono uppercase tracking-widest"
                placeholder="GB-XXXXX"
                value={joinDraft}
                onChange={(e) => setJoinDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleJoin()}
              />
              <button
                type="button"
                className="btn-primary whitespace-nowrap disabled:opacity-50"
                onClick={() => void handleJoin()}
                disabled={busy || !joinDraft.trim()}
              >
                {t('collab.joinCta')}
              </button>
            </div>
            <p className="mt-2 text-caption text-muted-soft break-keep">{t('collab.joinHint')}</p>
          </div>
        </div>
      )}
    </section>
  )
}
