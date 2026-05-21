import { get, set } from 'idb-keyval'

interface Entry<T> {
  value: T
  expiresAt: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000 // 24h (NFR-P03)

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
