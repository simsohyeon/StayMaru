import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCollab } from '@/stores/collab'
import { useSettings } from '@/stores/settings'
import { isCollabConfigured } from '@/lib/supabase'
import { toast } from '@/stores/toasts'
import type { Course } from '@/types/domain'

/**
 * 홈 "함께 짜는 코스" 섹션 — 코스를 먼저 만들지 않아도 협업을 시작/참여할 수 있는 진입점.
 *  - 빈 코스로 함께 시작: 빈 협업 방을 만들고 코스 키를 받아 친구를 초대 → 같이 장소를 채운다(여행 릴레이).
 *  - 친구 코스 키로 참여: 받은 GB-XXXXX 키를 붙여넣어 바로 합류.
 * Supabase 미설정 시 렌더하지 않는다(백엔드 없으면 실시간 협업 비활성).
 */
function makeEmptyCourse(lang: Course['lang'], title: string): Course {
  return {
    id: `course-${Date.now()}`,
    title,
    baseSigungus: [],
    duration: '1n2d',
    hiddenMode: false,
    items: [],
    totalDistanceKm: 0,
    estimatedTravelMinutes: 0,
    createdAt: new Date().toISOString(),
    lang,
  }
}

export default function CollabStart() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const createRoom = useCollab((s) => s.createRoom)
  const joinRoom = useCollab((s) => s.joinRoom)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isCollabConfigured()) return null

  async function handleStart() {
    if (busy) return
    setBusy(true)
    try {
      const { result } = await createRoom(makeEmptyCourse(lang, t('collab.newCourseTitle')))
      if (result === 'ok') nav('/course')
      else toast(t('collab.createFailed'), { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    const raw = draft.trim()
    if (!raw || busy) return
    setBusy(true)
    try {
      const r = await joinRoom(raw)
      if (r === 'ok') nav('/course')
      else toast(r === 'not-found' ? t('collab.notFound') : t('collab.joinFailed'), { type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card-pad">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl"
        >
          🤝
        </span>
        <div className="min-w-0">
          <p className="eyebrow">{t('collab.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink">{t('collab.startTitle')}</h2>
          <p className="mt-2 text-body-sm text-body break-keep">{t('collab.startSubtitle')}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 md:items-stretch">
        {/* 새로 시작 */}
        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={busy}
          className="btn-download w-full justify-center disabled:opacity-50"
        >
          🔑 {t('collab.startEmpty')}
        </button>

        {/* 코스 키로 참여 */}
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1 font-mono uppercase tracking-widest"
            placeholder="GB-XXXXX"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleJoin()}
          />
          <button
            type="button"
            onClick={() => void handleJoin()}
            disabled={busy || !draft.trim()}
            className="btn-primary whitespace-nowrap disabled:opacity-50"
          >
            {t('collab.joinCta')}
          </button>
        </div>
      </div>
      <p className="mt-3 text-caption text-muted-soft break-keep">{t('collab.startHint')}</p>
    </section>
  )
}
