import { useCallback, useEffect, useRef, useState } from 'react'

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ApiState<T> {
  data: T | undefined
  status: ApiStatus
  error: unknown
  /** 마지막 호출과 동일 파라미터로 재시도 */
  retry: () => void
}

/**
 * Promise 기반 호출을 로딩/에러/데이터 상태로 묶는다.
 *
 * - 마지막 호출이 unmount 후 setState 하지 않도록 cancelled 가드.
 * - retry() 는 deps 변경 없이도 같은 fetcher 를 다시 실행한다.
 * - tour.ts 의 SearchResult 처럼 빈 결과를 던지는 대신 error 필드를 반환하는 API 도
 *   onResult 콜백에서 `throw` 해서 error 상태로 승격할 수 있다.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  opts?: {
    /** 결과를 받아 추가 검증 — 던지면 error 로 분기 */
    validate?: (v: T) => void
    /** 비활성화 (조건부 호출) */
    enabled?: boolean
  },
): ApiState<T> {
  const enabled = opts?.enabled ?? true
  const [data, setData] = useState<T | undefined>(undefined)
  const [status, setStatus] = useState<ApiStatus>('idle')
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)

  // 매 렌더 갱신되어도 effect 가 다시 돌지 않도록 ref 에 보관.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const validateRef = useRef(opts?.validate)
  validateRef.current = opts?.validate

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setStatus('loading')
    setError(null)
    void fetcherRef
      .current()
      .then((v) => {
        if (cancelled) return
        try {
          validateRef.current?.(v)
        } catch (e) {
          setError(e)
          setStatus('error')
          return
        }
        setData(v)
        setStatus('success')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled])

  const retry = useCallback(() => setTick((t) => t + 1), [])
  return { data, status, error, retry }
}
