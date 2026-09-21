import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 관광 API 가 일일 한도·점검으로 막혔을 때 화면이 오류로 넘어가지 않아야 한다.
 * 만료된 캐시라도 들고 있으면 그것을 쓰고, 정말 아무것도 없을 때만 실패를 올린다.
 *
 * jsdom 에는 IndexedDB 가 없어 idb-keyval 을 인메모리 Map 으로 바꿔 끼운다 —
 * 검증 대상은 저장소가 아니라 cachedFetch 의 폴백 판단이다.
 */
const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => void store.set(k, v),
  clear: async () => void store.clear(),
}))

const { cachedFetch } = await import('./cache')

/** 만료된 상태로 캐시에 심는다 (TTL 0 → 저장 즉시 만료) */
async function seedExpired<T>(key: string, value: T): Promise<void> {
  await cachedFetch<T>(key, async () => value, 0, () => true)
}

describe('cachedFetch — 실패 시 만료 캐시 폴백', () => {
  beforeEach(() => {
    store.clear()
  })

  it('로더가 던지면 만료된 값을 대신 돌려준다', async () => {
    await seedExpired('k1', 'old')
    const v = await cachedFetch(
      'k1',
      async () => {
        throw new Error('quota exceeded')
      },
      0,
    )
    expect(v).toBe('old')
  })

  it('만료 캐시가 없으면 예외를 그대로 올린다', async () => {
    await expect(
      cachedFetch('k2', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })

  it('예외 대신 실패값을 받아도 만료 캐시로 대체한다', async () => {
    type R = { items: string[]; error?: string }
    await seedExpired<R>('k3', { items: ['안동 하회마을'] })

    const v = await cachedFetch<R>(
      'k3',
      async () => ({ items: [], error: 'quota' }),
      0,
      (r) => r.items.length > 0 && !r.error,
      (r) => !!r.error,
    )
    expect(v.items).toEqual(['안동 하회마을'])
    expect(v.error).toBeUndefined()
  })

  it('대체할 값이 없으면 실패값을 그대로 돌려준다 — 호출부가 오류 UI 를 그린다', async () => {
    type R = { items: string[]; error?: string }
    const v = await cachedFetch<R>(
      'k4',
      async () => ({ items: [], error: 'quota' }),
      0,
      (r) => r.items.length > 0 && !r.error,
      (r) => !!r.error,
    )
    expect(v.error).toBe('quota')
  })

  it('정상적인 "결과 0건"은 옛 목록으로 되살리지 않는다', async () => {
    type R = { items: string[]; error?: string }
    await seedExpired<R>('k5', { items: ['옛 장소'] })

    // 지금은 진짜로 0건 — 실패가 아니므로 폴백하면 안 된다
    const v = await cachedFetch<R>(
      'k5',
      async () => ({ items: [] }),
      0,
      (r) => r.items.length > 0 && !r.error,
      (r) => !!r.error,
    )
    expect(v.items).toEqual([])
  })

  it('카테고리 개수(undefined 로 실패)도 만료 캐시로 대체한다', async () => {
    await seedExpired<number | undefined>('k6', 33)

    const v = await cachedFetch<number | undefined>(
      'k6',
      async () => undefined,
      0,
      (n) => n !== undefined,
      (n) => n === undefined,
    )
    expect(v).toBe(33)
  })

  it('유효한 캐시가 있으면 로더를 아예 부르지 않는다', async () => {
    const loader = vi.fn(async () => 'fresh')
    await cachedFetch('k7', async () => 'first', 60_000)
    const v = await cachedFetch('k7', loader, 60_000)
    expect(v).toBe('first')
    expect(loader).not.toHaveBeenCalled()
  })
})
