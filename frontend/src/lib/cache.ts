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
  /**
   * 로더가 예외 대신 '실패를 뜻하는 값'을 돌려주는 경우의 판별자 (tour.ts 는 error 필드를 담아 반환한다).
   * true 면 만료된 캐시로 대체한다. shouldCache 와 따로 두는 이유 — "결과 0건"은 캐시하지 않지만
   * 정상 응답이므로, 그때 옛 목록을 되살리면 사용자에게 거짓을 보여주게 된다.
   */
  isFailure: (value: T) => boolean = () => false,
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
    let value: T
    try {
      value = await loader()
    } catch (err) {
      // 실패했다고 바로 오류 화면으로 보내지 않는다 — 만료된 값이라도 들고 있으면 그게 낫다.
      // 관광 API 는 일일 한도·점검으로 통째로 막히는 때가 있는데, 장소 목록은 하루 이틀
      // 묵어도 쓸 만한 데이터다. 보여줄 게 아무것도 없을 때만 오류를 올린다.
      const stale = await staleCached<T>(key)
      if (stale !== undefined) return stale
      throw err
    }
    if (isFailure(value)) {
      // 예외 대신 실패값을 받은 경우도 같게 다룬다. 대체할 게 없으면 실패값을 그대로 올려
      // 호출부가 오류 UI 를 그리게 둔다.
      const stale = await staleCached<T>(key)
      if (stale !== undefined) return stale
      return value
    }
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
