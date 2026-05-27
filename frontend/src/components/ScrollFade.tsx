import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

/**
 * 가로 스크롤 컨테이너 — 좌/우 가장자리에 페이드 그라데이션을 띄워
 * 더 많은 컨텐츠가 있다는 시각 단서를 제공한다.
 *
 * scrollbar-hide 로 스크롤바가 없어도 사용자가 가로로 더 스크롤할 수 있다는 사실을
 * 알아챌 수 있게 한다. (데스크탑 사용자가 가로 스크롤 가능 여부를 놓치는 문제 대응)
 */
interface Props {
  children: React.ReactNode
  className?: string
  /** Tailwind 색상 — fade gradient 의 from/to 끝 색 */
  fadeColor?: string
}

export default function ScrollFade({ children, className, fadeColor = '#faf9f5' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState<{ left: boolean; right: boolean }>({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 4
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
      setEdges({ left, right })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [children])

  return (
    <div className={clsx('relative', className)}>
      <div ref={ref} className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {children}
      </div>
      {/* 좌측 페이드 */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-y-0 left-0 w-8 transition-opacity',
          edges.left ? 'opacity-100' : 'opacity-0',
        )}
        style={{ background: `linear-gradient(to right, ${fadeColor}, transparent)` }}
      />
      {/* 우측 페이드 */}
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-y-0 right-0 w-8 transition-opacity',
          edges.right ? 'opacity-100' : 'opacity-0',
        )}
        style={{ background: `linear-gradient(to left, ${fadeColor}, transparent)` }}
      />
    </div>
  )
}
