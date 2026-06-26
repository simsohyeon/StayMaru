import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { SIGUNGUS, findSigungu } from '@/constants/sigungu'
import { PROFILE_LABELS } from '@/constants/categories'
import { COMPANIONS } from '@/constants/companions'
import type { Companion, CourseProfile, DateRange, Lang, TripDuration } from '@/types/domain'

/** 챗봇이 모아 부모에게 넘기는 값 — Home.generateFromInput 의 입력과 동일 형태. */
export interface ChatbotResult {
  sigunguCodes: number[]
  duration: TripDuration
  /** 사용자가 날짜를 직접 골랐을 때만 — 없으면 부모가 duration 으로 계산 */
  dateRange?: DateRange
  profiles: CourseProfile[]
  companions: Companion[]
}

type Step = 'region' | 'duration' | 'companion' | 'profile' | 'confirm'

// 챗봇에서 노출할 코스 유형 — known_gb 는 '아무거나' 폴백이라 제외.
const PROFILE_OPTIONS: CourseProfile[] = [
  'hanok_emotion',
  'temple_healing',
  'experience_focus',
  'festival_link',
  'hidden_gb',
]

const DURATION_OPTIONS: { v: TripDuration; key: string }[] = [
  { v: 'day', key: 'day' },
  { v: '1n2d', key: 'n1d2' },
  { v: '2n3d', key: 'n2d3' },
]

interface Msg {
  role: 'bot' | 'user'
  text: string
}

// ─── 날짜 helper (Home 과 동일 규칙, KST 기준) ───
function todayPlusYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}
function rangeNights(r: DateRange): number {
  const ms = new Date(r.end).getTime() - new Date(r.start).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}
/** date input 을 Delete 로 비우면 value='' — NaN 박 표시·빈 날짜 확정을 막는다. */
function isValidRange(r: DateRange): boolean {
  return (
    !!r.start &&
    !!r.end &&
    !Number.isNaN(new Date(r.start).getTime()) &&
    !Number.isNaN(new Date(r.end).getTime())
  )
}
function durationFromRange(r: DateRange): TripDuration {
  const n = rangeNights(r)
  if (n === 0) return 'day'
  if (n === 1) return '1n2d'
  if (n === 2) return '2n3d'
  return 'custom'
}

/**
 * 은행 챗봇 스타일 — 자연어 대화가 아니라 버튼으로 선택지를 좁혀가는 시나리오 봇.
 * LLM·외부 API·비용 없음. 한 줄 입력과 동일한 코스 엔진(generateFromInput)으로 합류한다.
 *
 * variant:
 *  - 'embedded' (기본): 홈 히어로에 카드로 항상 노출. 백드롭/닫기 없음.
 *  - 'modal': 오버레이 모달. open/onClose 로 제어.
 */
export default function TripChatbot({
  open = true,
  variant = 'embedded',
  lang,
  busy,
  onClose,
  onComplete,
}: {
  open?: boolean
  variant?: 'embedded' | 'modal'
  lang: Lang
  busy?: boolean
  onClose?: () => void
  onComplete: (r: ChatbotResult) => void
}) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('region')
  const [regions, setRegions] = useState<number[]>([])
  const [duration, setDuration] = useState<TripDuration | null>(null)
  const [dateRange, setDateRange] = useState<DateRange | null>(null)
  const [companions, setCompanions] = useState<Companion[]>([])
  const [profiles, setProfiles] = useState<CourseProfile[]>([])
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const typingTimer = useRef<number | null>(null)
  // 날짜 직접 선택 패널
  const [showDates, setShowDates] = useState(false)
  const [customRange, setCustomRange] = useState<DateRange>(() => ({
    start: todayPlusYmd(0),
    end: todayPlusYmd(1),
  }))
  const scrollRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  const langKey = lang as 'ko' | 'en' | 'ja' | 'zh'

  // 봇 발화 — 짧게 "입력 중…" 인디케이터를 보였다가 메시지를 추가해 대화 느낌을 준다.
  function botSay(text: string) {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    setTyping(true)
    typingTimer.current = window.setTimeout(() => {
      setTyping(false)
      setMsgs((cur) => [...cur, { role: 'bot', text }])
      typingTimer.current = null
    }, 480)
  }

  function greet() {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    setTyping(false)
    setStep('region')
    setRegions([])
    setDuration(null)
    setDateRange(null)
    setCompanions([])
    setProfiles([])
    setShowDates(false)
    setMsgs([{ role: 'bot', text: t('home.chatbot.greeting') }])
    botSay(t('home.chatbot.askRegion'))
  }

  // 각 단계의 사용자 답변 버블 텍스트 — 현재 선택 상태에서 파생(이전 버튼 복원에도 사용).
  const regionText = () =>
    regions.length
      ? regions.map((c) => findSigungu(c)?.[langKey]).filter(Boolean).join(' · ')
      : t('home.chatbot.regionAny')
  const durationText = () =>
    dateRange
      ? `${dateRange.start} → ${dateRange.end}`
      : duration
        ? t(`duration.${duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration}`)
        : ''
  const companionText = () =>
    companions.length
      ? companions
          .map((c) => t(`home.chatbot.companions.${COMPANIONS.find((x) => x.id === c)?.key}`))
          .join(' · ')
      : t('home.chatbot.companionAny')
  const profileText = () =>
    profiles.length
      ? profiles.map((p) => PROFILE_LABELS[p][lang]).join(' · ')
      : t('home.chatbot.profileAny')

  const STEP_FLOW: Step[] = ['region', 'duration', 'companion', 'profile', 'confirm']

  // 이전 단계로 — 메시지 로그를 선택 상태에서 결정적으로 재구성(타이핑 레이스 무관).
  function buildLog(target: Step): Msg[] {
    const log: Msg[] = [
      { role: 'bot', text: t('home.chatbot.greeting') },
      { role: 'bot', text: t('home.chatbot.askRegion') },
    ]
    if (target === 'region') return log
    log.push({ role: 'user', text: regionText() }, { role: 'bot', text: t('home.chatbot.askDuration') })
    if (target === 'duration') return log
    log.push({ role: 'user', text: durationText() }, { role: 'bot', text: t('home.chatbot.askCompanion') })
    if (target === 'companion') return log
    log.push({ role: 'user', text: companionText() }, { role: 'bot', text: t('home.chatbot.askProfile') })
    if (target === 'profile') return log
    log.push({ role: 'user', text: profileText() }, { role: 'bot', text: t('home.chatbot.summaryIntro') })
    return log
  }

  function back() {
    const idx = STEP_FLOW.indexOf(step)
    if (idx <= 0) return
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
      typingTimer.current = null
    }
    setTyping(false)
    setShowDates(false)
    const target = STEP_FLOW[idx - 1]
    setStep(target)
    setMsgs(buildLog(target))
  }

  // 열릴 때마다 처음부터 — 인사 + 첫 질문. open 이 truthy 로 바뀔 때 1회만(ref 가드).
  // t 를 deps 에 넣지 않는다 — 언어 변경마다 greet 가 재실행돼 무한 리렌더가 될 위험을 차단.
  useEffect(() => {
    if (!open) {
      startedRef.current = false
      return
    }
    if (startedRef.current) return
    startedRef.current = true
    greet()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 언어 전환 시 말풍선 재구성 — 메시지는 t() 결과 스냅샷이라 자동 갱신되지 않는다.
  // buildLog 는 선택 상태에서 결정적으로 전체 로그를 복원하므로 안전.
  const langRef = useRef(lang)
  useEffect(() => {
    if (langRef.current === lang) return
    langRef.current = lang
    if (!startedRef.current) return
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
      typingTimer.current = null
    }
    setTyping(false)
    setMsgs(buildLog(step))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // modal 일 때만 ESC 닫기 + body scroll lock
  useEffect(() => {
    if (variant !== 'modal' || !open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [variant, open, onClose])

  // 새 메시지 / 단계 변화 / 타이핑 시 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, step, typing])

  // 언마운트 시 타이핑 타이머 정리
  useEffect(() => () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
  }, [])

  const push = (m: Msg) => setMsgs((cur) => [...cur, m])

  const toggleRegion = (code: number) =>
    setRegions((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code].slice(-3),
    )

  const toggleCompanion = (c: Companion) =>
    setCompanions((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const toggleProfile = (p: CourseProfile) =>
    setProfiles((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  function confirmRegion(auto: boolean) {
    const codes = auto ? [] : regions
    if (auto) setRegions([])
    push({
      role: 'user',
      text:
        codes.length === 0
          ? t('home.chatbot.regionAny')
          : codes
              .map((c) => findSigungu(c)?.[langKey])
              .filter(Boolean)
              .join(' · '),
    })
    setStep('duration')
    botSay(t('home.chatbot.askDuration'))
  }

  // 빠른 기간 버튼 — dateRange 없이 duration 만
  function pickDuration(d: TripDuration, label: string) {
    setDuration(d)
    setDateRange(null)
    push({ role: 'user', text: label })
    setStep('companion')
    botSay(t('home.chatbot.askCompanion'))
  }

  // 날짜 직접 선택 확정
  function confirmDates() {
    if (!isValidRange(customRange)) return
    const r = customRange
    const d = durationFromRange(r)
    setDuration(d)
    setDateRange(r)
    setShowDates(false)
    push({ role: 'user', text: `${r.start} → ${r.end}` })
    setStep('companion')
    botSay(t('home.chatbot.askCompanion'))
  }

  function confirmCompanion() {
    push({
      role: 'user',
      text:
        companions.length === 0
          ? t('home.chatbot.companionAny')
          : companions
              .map((c) => t(`home.chatbot.companions.${COMPANIONS.find((x) => x.id === c)?.key}`))
              .join(' · '),
    })
    setStep('profile')
    botSay(t('home.chatbot.askProfile'))
  }

  function confirmProfile(auto: boolean) {
    const ps = auto ? [] : profiles
    if (auto) setProfiles([])
    push({
      role: 'user',
      text:
        ps.length === 0
          ? t('home.chatbot.profileAny')
          : ps.map((p) => PROFILE_LABELS[p][lang]).join(' · '),
    })
    setStep('confirm')
    botSay(t('home.chatbot.summaryIntro'))
  }

  const summary = useMemo(() => {
    const parts: string[] = []
    parts.push(
      regions.length
        ? regions
            .map((c) => findSigungu(c)?.[langKey])
            .filter(Boolean)
            .join(' · ')
        : t('home.chatbot.regionAny'),
    )
    if (dateRange) {
      parts.push(`${dateRange.start} → ${dateRange.end}`)
    } else if (duration) {
      const dk = duration === '1n2d' ? 'n1d2' : duration === '2n3d' ? 'n2d3' : duration
      parts.push(t(`duration.${dk}`))
    }
    if (companions.length) {
      parts.push(
        companions
          .map((c) => t(`home.chatbot.companions.${COMPANIONS.find((x) => x.id === c)?.key}`))
          .join(' · '),
      )
    }
    parts.push(
      profiles.length
        ? profiles.map((p) => PROFILE_LABELS[p][lang]).join(' · ')
        : t('home.chatbot.profileAny'),
    )
    return parts.join('  ·  ')
  }, [regions, duration, dateRange, companions, profiles, lang, langKey, t])

  if (!open) return null

  // 진행 표시 — 'confirm' 은 전체 완료로 간주
  const flowSteps: Step[] = ['region', 'duration', 'companion', 'profile']
  const activeIdx = step === 'confirm' ? flowSteps.length : flowSteps.indexOf(step)

  // ─── 메시지 + 단계별 선택지 (공통 내부) ───
  const inner = (
    <>
      {/* 진행 표시기 */}
      <div className="chatbot__steps scrollbar-hide">
        {flowSteps.map((s, i) => {
          const done = i < activeIdx
          const active = i === activeIdx
          return (
            <div key={s} className="chatbot__step">
              <span
                className={clsx(
                  'chatbot__step-num',
                  done
                    ? 'chatbot__step-num--done'
                    : active
                      ? 'chatbot__step-num--active'
                      : 'chatbot__step-num--idle',
                )}
              >
                <span aria-hidden>{done ? '✓' : i + 1}</span>
              </span>
              <span
                className={clsx(
                  'chatbot__step-label',
                  done || active ? 'chatbot__step-label--on' : 'chatbot__step-label--off',
                )}
              >
                {t(`home.chatbot.steps.${s}`)}
              </span>
              {i < flowSteps.length - 1 && <span className="chatbot__step-line" />}
            </div>
          )
        })}
      </div>

      {/* Messages — role=log + aria-live 로 봇 발화를 보조기기에 통지 */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        className={clsx(
          'chatbot__messages',
          variant === 'modal' ? 'chatbot__messages--modal' : 'chatbot__messages--embedded',
        )}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            className={clsx('chatbot__row', m.role === 'user' ? 'chatbot__row--user' : 'chatbot__row--bot')}
          >
            <div
              className={clsx(
                'chatbot__bubble',
                m.role === 'user' ? 'chatbot__bubble--user' : 'chatbot__bubble--bot',
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {/* 입력 중… 인디케이터 */}
        {typing && (
          <div className="chatbot__typing">
            <div className="chatbot__typing-inner">
              <span className="chatbot__typing-dot chatbot__typing-dot--d0" />
              <span className="chatbot__typing-dot chatbot__typing-dot--d1" />
              <span className="chatbot__typing-dot chatbot__typing-dot--d2" />
            </div>
          </div>
        )}
      </div>

      {/* Option area */}
      <div
        className="chatbot__options"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
      >
        {/* 이전 단계로 */}
        {step !== 'region' && (
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="chatbot__back"
          >
            <span aria-hidden>←</span> {t('home.chatbot.back')}
          </button>
        )}

        {/* Step: region */}
        {step === 'region' && (
          <>
            <p className="chatbot__hint">{t('home.chatbot.regionHint')}</p>
            <div className="chatbot__chips">
              {SIGUNGUS.map((sg) => {
                const active = regions.includes(sg.code)
                return (
                  <button
                    key={sg.code}
                    type="button"
                    onClick={() => toggleRegion(sg.code)}
                    className={clsx('chip', active && 'chip-active')}
                  >
                    {sg[langKey]}
                  </button>
                )
              })}
            </div>
            <div className="chatbot__actions">
              <button
                type="button"
                onClick={() => confirmRegion(true)}
                className="chatbot__btn-soft"
              >
                {t('home.chatbot.regionAny')}
              </button>
              <button
                type="button"
                onClick={() => confirmRegion(false)}
                disabled={regions.length === 0}
                className="btn-primary chatbot__btn-next"
              >
                {t('home.chatbot.next')}
              </button>
            </div>
          </>
        )}

        {/* Step: duration — 빠른 버튼 + 날짜 직접 선택 */}
        {step === 'duration' && (
          <>
            <div className="chatbot__duration-grid">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => pickDuration(d.v, t(`duration.${d.key}`))}
                  className="chatbot__duration-btn"
                >
                  {t(`duration.${d.key}`)}
                </button>
              ))}
            </div>
            {!showDates ? (
              <button
                type="button"
                onClick={() => setShowDates(true)}
                className="chatbot__date-toggle"
              >
                <span aria-hidden>📅</span> {t('home.chatbot.pickDates')}
              </button>
            ) : (
              <div className="surface-pane chatbot__pane-stack">
                <div className="chatbot__date-grid">
                  <label className="chatbot__date-field">
                    <span className="eyebrow chatbot__date-label">{t('home.dateStart')}</span>
                    <input
                      type="date"
                      className="input chatbot__date-input"
                      value={customRange.start}
                      min={todayPlusYmd(0)}
                      max={customRange.end}
                      onChange={(e) => {
                        const start = e.target.value
                        setCustomRange((r) => ({ start, end: r.end < start ? start : r.end }))
                      }}
                    />
                  </label>
                  <label className="chatbot__date-field">
                    <span className="eyebrow chatbot__date-label">{t('home.dateEnd')}</span>
                    <input
                      type="date"
                      className="input chatbot__date-input"
                      value={customRange.end}
                      min={customRange.start}
                      onChange={(e) => {
                        const end = e.target.value
                        setCustomRange((r) => ({ start: r.start > end ? end : r.start, end }))
                      }}
                    />
                  </label>
                </div>
                {isValidRange(customRange) && (
                  <p className="chatbot__nights">
                    {t('duration.nightsDays', {
                      n: rangeNights(customRange),
                      m: rangeNights(customRange) + 1,
                    })}
                  </p>
                )}
                <button
                  type="button"
                  onClick={confirmDates}
                  disabled={!isValidRange(customRange)}
                  className="btn-primary chatbot__date-confirm"
                >
                  {t('home.chatbot.next')}
                </button>
              </div>
            )}
          </>
        )}

        {/* Step: companion — 복수 선택 (무장애 포함) */}
        {step === 'companion' && (
          <>
            <p className="chatbot__hint">{t('home.chatbot.companionHint')}</p>
            <div className="chatbot__grid-2">
              {COMPANIONS.map((c) => {
                const active = companions.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompanion(c.id)}
                    className={clsx(
                      'chatbot__companion-btn',
                      active
                        ? 'chatbot__companion-btn--active'
                        : 'chatbot__companion-btn--idle',
                    )}
                  >
                    <span aria-hidden>{c.emoji}</span>
                    {t(`home.chatbot.companions.${c.key}`)}
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={confirmCompanion} className="btn-primary chatbot__full-btn">
              {companions.length === 0 ? t('home.chatbot.skip') : t('home.chatbot.next')}
            </button>
          </>
        )}

        {/* Step: profile */}
        {step === 'profile' && (
          <>
            <div className="chatbot__grid-2">
              {PROFILE_OPTIONS.map((p) => {
                const active = profiles.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProfile(p)}
                    className={clsx(
                      'chatbot__profile-btn',
                      active
                        ? 'chatbot__profile-btn--active'
                        : 'chatbot__profile-btn--idle',
                    )}
                  >
                    {PROFILE_LABELS[p][lang]}
                  </button>
                )
              })}
            </div>
            <div className="chatbot__actions">
              <button
                type="button"
                onClick={() => confirmProfile(true)}
                className="chatbot__btn-soft"
              >
                {t('home.chatbot.profileAny')}
              </button>
              <button
                type="button"
                onClick={() => confirmProfile(false)}
                disabled={profiles.length === 0}
                className="btn-primary chatbot__btn-next"
              >
                {t('home.chatbot.next')}
              </button>
            </div>
          </>
        )}

        {/* Step: confirm */}
        {step === 'confirm' && (
          <>
            <div className="surface-pane">
              <p className="eyebrow chatbot__summary-eyebrow">{t('home.sticky.eyebrow')}</p>
              <p className="chatbot__summary-line">{summary}</p>
            </div>
            <div className="chatbot__actions">
              <button
                type="button"
                onClick={greet}
                disabled={busy}
                className="chatbot__btn-restart"
              >
                <span aria-hidden>↺</span> {t('home.chatbot.restart')}
              </button>
              <button
                type="button"
                onClick={() =>
                  onComplete({
                    sigunguCodes: regions,
                    duration: duration ?? '1n2d',
                    dateRange: dateRange ?? undefined,
                    profiles,
                    companions,
                  })
                }
                disabled={busy}
                className="btn-primary chatbot__btn-generate"
              >
                {busy ? t('course.generating') : t('home.chatbot.generate')}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )

  const header = (
    <header className="chatbot__header">
      <div className="chatbot__header-main">
        <span
          aria-hidden
          className="chatbot__avatar"
        >
          🤖
        </span>
        <div className="chatbot__header-text">
          <h2 className="chatbot__title">{t('home.chatbot.title')}</h2>
          <p className="chatbot__subtitle">{t('home.chatbot.subtitle')}</p>
        </div>
      </div>
      {variant === 'modal' && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="chatbot__close"
        >
          ✕
        </button>
      )}
    </header>
  )

  // ─── embedded: 히어로 카드 ───
  if (variant === 'embedded') {
    return (
      <div className="chatbot__card">
        {header}
        {inner}
      </div>
    )
  }

  // ─── modal ───
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="chatbot__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="chatbot__panel">
        {header}
        {inner}
      </div>
    </div>
  )
}
