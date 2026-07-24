import { clear, get, set } from 'idb-keyval'

interface Entry<T> {
  value: T
  expiresAt: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h (NFR-P03)

// 진행 중(in-flight) 로더 공유 — 같은 key 를 동시에 요청하면(예: 한 화면의 두 컴포넌트가
// 같은 DataLab 통계를 부를 때) 무거운 API 를 중복 호출하지 않고 하나의 Promise 를 재사용한다.
const inflight = new Map<string, Promise<unknown>>()

export async function cachedFetch<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
  shouldCache: (value: T) => boolean = () => true,
): Promise<T> {
  try {
    const hit = (await get(key)) as Entry<T> | undefined
    if (hit && hit.expiresAt > Date.now()) {
      return hit.value
    }
  } catch {
    // IndexedDB 미지원 환경(SSR/iframe sandbox 등) — 캐시 무시
  }

  // 캐시 미스 — 동일 key 로 이미 진행 중인 로더가 있으면 그 결과를 공유한다.
  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const run = (async () => {
    const value = await loader()
    if (shouldCache(value)) {
      try {
        const entry: Entry<T> = { value, expiresAt: Date.now() + ttlMs }
        await set(key, entry)
      } catch {
        // 캐시 저장 실패는 치명적이지 않음
      }
    }
    return value
  })().finally(() => {
    inflight.delete(key)
  })

  inflight.set(key, run)
  return run as Promise<T>
}

/** 만료된 항목도 허용해 stale-while-revalidate 형태로 사용할 수 있게 한다 */
export async function staleCached<T>(key: string): Promise<T | undefined> {
  try {
    const hit = (await get(key)) as Entry<T> | undefined
    return hit?.value
  } catch {
    return undefined
  }
}

/** Settings 의 "캐시 비우기" 에서 사용. IndexedDB 의 keyval-store 전체 삭제. */
export async function clearAllCache(): Promise<void> {
  try {
    await clear()
  } catch {
    /* 미지원 환경 — 무시 */
  }
}
