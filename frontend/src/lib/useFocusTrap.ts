import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 모달/라이트박스용 Tab 포커스 트랩 — active 동안 Tab 순환을 컨테이너 안에 가둔다.
 * 초기 포커스 이동과 닫힐 때 포커스 복원은 호출부 책임.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const root = ref.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const cur = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (cur === first || !root.contains(cur)) {
          e.preventDefault()
          last.focus()
        }
      } else if (cur === last || !root.contains(cur)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ref, active])
}
