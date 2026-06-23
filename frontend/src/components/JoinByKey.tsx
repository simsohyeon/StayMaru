import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCollab } from '@/stores/collab'
import { isCollabConfigured } from '@/lib/supabase'
import { toast } from '@/stores/toasts'

/**
 * 코스 키 붙여넣기 참여 — 홈에서 친구가 보낸 "코스 키(방 코드)"를 붙여넣어 바로 합류.
 * Supabase 미설정 시 렌더하지 않는다(폴백 환경에선 키 협업 자체가 비활성).
 */
export default function JoinByKey() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const joinRoom = useCollab((s) => s.joinRoom)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isCollabConfigured()) return null

  async function handleJoin() {
    const raw = draft.trim()
    if (!raw || busy) return
    setBusy(true)
    try {
      const result = await joinRoom(raw)
      if (result === 'ok') {
        nav('/course')
      } else {
        toast(result === 'not-found' ? t('collab.notFound') : t('collab.joinFailed'), {
          type: 'error',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted hover:text-primary transition-colors"
      >
        🔑 {t('collab.haveKey')}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        autoFocus
        className="input w-40 font-mono uppercase tracking-widest"
        placeholder="GB-XXXXX"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void handleJoin()}
      />
      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={busy || !draft.trim()}
        className="btn-primary disabled:opacity-50"
      >
        {t('collab.joinCta')}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-caption text-muted hover:text-ink"
      >
        {t('common.close')}
      </button>
    </div>
  )
}
