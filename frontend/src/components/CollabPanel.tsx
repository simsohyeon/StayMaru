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
      <section className="card-pad collab-panel__unconfigured">
        <p className="eyebrow">{t('collab.eyebrow')}</p>
        <p className="collab-panel__unconfigured-text">{t('collab.unconfigured')}</p>
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
    <section className="card-pad collab-panel">
      <header className="collab-panel__header">
        <div>
          <p className="eyebrow">{t('collab.eyebrow')}</p>
          <h2 className="collab-panel__title">{t('collab.title')}</h2>
          <p className="collab-panel__subtitle">{t('collab.subtitle')}</p>
        </div>
        {isLive && (
          <span className="collab-panel__live">
            <span className="collab-panel__live-dot" aria-hidden />
            {t('collab.live')}
          </span>
        )}
      </header>

      {/* 닉네임 — 협업 식별용(로그인 아님) */}
      <div>
        <label className="eyebrow collab-panel__label">{t('collab.nickname')}</label>
        <div className="collab-panel__field">
          <input
            type="text"
            className="input collab-panel__nickname-input"
            placeholder={t('collab.nicknamePlaceholder')}
            value={nameDraft}
            maxLength={16}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => nameDraft.trim() && setNickname(nameDraft)}
          />
          <span
            className="collab-panel__avatar"
            style={{ backgroundColor: me.color }}
            aria-hidden
          >
            {(nameDraft.trim() || '?')[0].toUpperCase()}
          </span>
        </div>
      </div>

      {activeCode ? (
        // ── 협업 중 — 코스 키 노출 ──
        <div className="collab-panel__live-section">
          <div className="surface-pane">
            <p className="eyebrow collab-panel__key-label">{t('collab.courseKey')}</p>
            <div className="collab-panel__key-row">
              <code className="collab-panel__key-code">
                {activeCode}
              </code>
              <button type="button" className="chip" onClick={() => void copyCode(activeCode)}>
                📋 {t('collab.copyKey')}
              </button>
              <button type="button" className="chip" onClick={() => setShowQr((v) => !v)}>
                ▦ QR
              </button>
            </div>
            <p className="collab-panel__hint">{t('collab.keyHint')}</p>
            {showQr && qrUrl && (
              <img
                src={qrUrl}
                alt={t('collab.qrAlt')}
                className="collab-panel__qr"
                width={140}
                height={140}
              />
            )}
          </div>

          {/* 기여자 + 실시간 접속자 */}
          <div>
            <p className="eyebrow collab-panel__contrib-label">
              {t('collab.contributors', { count: contributors.length })}
            </p>
            <div className="collab-panel__contrib-list">
              {contributors.map((c) => {
                const online = peers.includes(c.name)
                return (
                  <span
                    key={c.id}
                    className={clsx(
                      'collab-panel__contrib',
                      online ? 'collab-panel__contrib--online' : 'collab-panel__contrib--offline',
                    )}
                  >
                    <span className="collab-panel__contrib-dot" style={{ backgroundColor: c.color }} aria-hidden />
                    {c.name || t('collab.anon')}
                    {c.id === me.id && ` (${t('collab.you')})`}
                    {online && <span className="collab-panel__contrib-online-mark" aria-hidden>●</span>}
                  </span>
                )
              })}
            </div>
          </div>

          <button type="button" className="btn-text collab-panel__leave" onClick={leaveRoom}>
            {t('collab.leave')}
          </button>
        </div>
      ) : (
        // ── 비협업 — 만들기 / 참여 ──
        <div className="collab-panel__join-section">
          <button
            type="button"
            className="btn-download collab-panel__create"
            onClick={() => void handleCreate()}
            disabled={busy}
          >
            🔑 {t('collab.create')}
          </button>

          <div className="collab-panel__divider" aria-hidden>
            <span className="collab-panel__divider-line" />
            <span className="collab-panel__divider-text">
              {t('collab.or')}
            </span>
            <span className="collab-panel__divider-line" />
          </div>

          <div>
            <label className="eyebrow collab-panel__label">{t('collab.joinLabel')}</label>
            <div className="collab-panel__field">
              <input
                type="text"
                className="input collab-panel__join-input"
                placeholder="GB-XXXXX"
                value={joinDraft}
                onChange={(e) => setJoinDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleJoin()}
              />
              <button
                type="button"
                className="btn-primary collab-panel__join-cta"
                onClick={() => void handleJoin()}
                disabled={busy || !joinDraft.trim()}
              >
                {t('collab.joinCta')}
              </button>
            </div>
            <p className="collab-panel__hint">{t('collab.joinHint')}</p>
          </div>
        </div>
      )}
    </section>
  )
}
