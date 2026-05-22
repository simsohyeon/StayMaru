import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import { hasSeenOnboarding, markOnboardingSeen } from '@/lib/onboarding'

/**
 * 첫 진입 3-스텝 코치마크. 모달이 아닌 풀-스크린 카드 시퀀스로
 * "이 서비스가 무엇인지" 5초 안에 전달한다.
 *
 * 트리거:
 *  - mount 시 localStorage 미플래그면 자동 노출
 *  - 부모가 `forceOpen` 으로 강제 노출 가능 (Settings의 "온보딩 다시 보기")
 */

interface Props {
  /** Settings 에서 강제 노출 시 true */
  forceOpen?: boolean
  /** 닫혔을 때 알림 (forceOpen 모드에서 부모 상태 동기화) */
  onClose?: () => void
}

const STEPS = ['step1', 'step2', 'step3'] as const

export default function OnboardingTour({ forceOpen, onClose }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (forceOpen) {
      setIdx(0)
      setOpen(true)
      return
    }
    if (!hasSeenOnboarding()) {
      // 다음 프레임에 노출 — initial paint 후 살짝 늦춰 인상 부드럽게
      const id = window.setTimeout(() => setOpen(true), 200)
      return () => window.clearTimeout(id)
    }
  }, [forceOpen])

  // ESC 닫기 + body scroll lock
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function finish() {
    markOnboardingSeen()
    setOpen(false)
    onClose?.()
  }
  function next() {
    if (idx >= STEPS.length - 1) finish()
    else setIdx(idx + 1)
  }

  if (!open) return null
  const step = STEPS[idx]
  const isLast = idx === STEPS.length - 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
    >
      <div
        key={step}
        className="w-full max-w-md rounded-xl border border-hairline bg-card p-8 shadow-2xl animate-fade-scale"
      >
        {/* 진행 표시 — 점 3개 */}
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={clsx(
                'h-1.5 flex-1 rounded-pill transition-colors',
                i <= idx ? 'bg-ink' : 'bg-hairline',
              )}
              aria-hidden
            />
          ))}
        </div>

        <p className="mt-6 font-mono text-eyebrow uppercase text-muted">
          {String(idx + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
        </p>
        <h2
          id="onboarding-title"
          className="mt-2 font-display text-display-md text-ink break-keep"
        >
          {t(`onboarding.${step}Title`)}
        </h2>
        <p className="mt-3 text-body-md text-body break-keep whitespace-pre-line">
          {t(`onboarding.${step}Body`)}
        </p>

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="font-mono text-caption text-muted-soft hover:text-ink"
          >
            {t('onboarding.skipLabel')}
          </button>
          <button type="button" onClick={next} className="btn-primary">
            {isLast ? t('onboarding.startLabel') : t('onboarding.nextLabel')}
          </button>
        </div>
      </div>
    </div>
  )
}
