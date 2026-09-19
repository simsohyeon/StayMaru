import { useEffect, useRef, useState } from 'react'

/**
 * 원본(digital.khs.go.kr)의 GSAP ScrollTrigger 리빌을 의존성 없이 재현한다.
 *
 * 원본 사양 (런타임 ScrollTrigger.getAll() 에서 추출):
 *   start: 'top 80%'  (일부 'top 50%')
 *   toggleActions: 'play none none none'  → 한 번만 재생, 되감기 없음
 *   tween: opacity 0→1, y →0, duration 0.7, ease power2.out, stagger 0.1 / 0.08
 *
 * 'top N%' = 대상의 top 이 뷰포트 높이의 N% 지점에 닿을 때.
 * IntersectionObserver 의 rootMargin bottom 을 -(100-N)% 로 주면 같은 시점이 된다.
 */
/** 모션 감소 환경이면 처음부터 최종 상태로 둔다 (effect 안에서 동기 setState 하지 않기 위해). */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useKhsReveal<T extends HTMLElement = HTMLDivElement>(startPercent = 80) {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(prefersReducedMotion)

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect() // toggleActions 'play none none none' — 재생은 한 번뿐
        }
      },
      { rootMargin: `0px 0px -${100 - startPercent}% 0px`, threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, startPercent])

  return { ref, shown }
}
