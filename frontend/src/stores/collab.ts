import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CollabContributor, Course } from '@/types/domain'
import { getSupabase, isCollabConfigured, type SharedCourseRow } from '@/lib/supabase'
import { mergeCourses } from '@/lib/courseEngine'
import { useCourses } from '@/stores/courses'

/**
 * 코스 실시간 협업 스토어 — 로그인 없이(익명) "코스 키(방 코드)" 하나로 친구와 같은 코스를 CRUD.
 *
 * 정체성(me)은 기기별 영구 저장(localStorage). 방 연결(channel/code/version)은 휘발성.
 * 원격 변경은 버전 기반 Last-Write-Wins 로 적용하되, 들어온 코스에 내가 모르는 장소가 있으면
 * mergeCourses 로 합쳐(union) 손실을 줄인다.
 *
 * env 미설정(isCollabConfigured()===false) 이면 createRoom/joinRoom 이 'unconfigured' 를 반환,
 * UI 는 기존 URL 링크 공유로 폴백한다.
 */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 혼동 문자(I,L,O,0,1) 제외
const CONTRIB_COLORS = [
  '#c2410c', '#0e7490', '#4d7c0f', '#7c3aed', '#be123c', '#0369a1', '#a16207', '#15803d',
]

function randomCode(): string {
  const bytes = new Uint8Array(5)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < 5; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  return `GB-${s}`
}

function randomId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 코드 정규화 — 사용자가 소문자/공백/접두 누락으로 붙여넣어도 받아준다. */
export function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '')
  const body = cleaned.replace(/^GB-?/, '')
  return `GB-${body}`
}

export type CollabStatus = 'idle' | 'connecting' | 'live' | 'error'
export type CollabResult = 'ok' | 'unconfigured' | 'not-found' | 'error'

interface CollabState {
  /** 익명 정체성 — 영구 저장 */
  me: CollabContributor
  /** 현재 연결된 방 코드(코스 키). null 이면 비공유. */
  code: string | null
  status: CollabStatus
  /** 현재 방에 접속 중인 기여자 이름들(presence) */
  peers: string[]
  /** 마지막으로 알고 있는 서버 버전 — LWW 비교용 */
  version: number

  setNickname: (name: string) => void
  /** 새 방 생성 — 코스를 서버에 올리고 코드를 반환. 코스에 collabCode/contributor 를 심는다. */
  createRoom: (course: Course) => Promise<{ result: CollabResult; code?: string }>
  /** 기존 방 참여 — 서버 코스를 받아 current 로 세팅. */
  joinRoom: (code: string) => Promise<CollabResult>
  /** 현재 코스를 서버에 반영(디바운스). 협업 중이 아니면 no-op. */
  publish: (course: Course) => void
  /** 방 나가기 — 구독 해제. 로컬 코스는 유지. */
  leaveRoom: () => void
}

// 모듈 스코프 — 채널/타이머는 스토어 상태 밖에서 관리(직렬화 대상 아님).
let channel: RealtimeChannel | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null

function teardownChannel() {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  if (channel) {
    const sb = getSupabase()
    sb?.removeChannel(channel)
    channel = null
  }
}

export const useCollab = create<CollabState>()(
  persist(
    (set, get) => ({
      me: { id: randomId(), name: '', color: CONTRIB_COLORS[0] },
      code: null,
      status: 'idle',
      peers: [],
      version: 0,

      setNickname: (name) =>
        set((s) => ({ me: { ...s.me, name: name.trim().slice(0, 16) } })),

      createRoom: async (course) => {
        if (!isCollabConfigured()) return { result: 'unconfigured' }
        const sb = getSupabase()
        if (!sb) return { result: 'unconfigured' }
        const me = get().me
        const code = randomCode()
        // 코스에 협업 메타 심기 — 생성자를 첫 기여자로, 기여한 장소에 addedBy 태그.
        const seeded: Course = {
          ...course,
          collabCode: code,
          contributors: [me],
          items: course.items.map((it) => ({ ...it, addedBy: it.addedBy ?? me.id })),
          updatedAt: new Date().toISOString(),
        }
        const { error } = await sb
          .from('shared_courses')
          .insert({ code, course: seeded, version: 1 })
        if (error) {
          console.error('[collab.createRoom]', error)
          return { result: 'error' }
        }
        set({ code, version: 1, status: 'connecting' })
        useCourses.getState().setCurrent(seeded)
        useCourses.getState().save(seeded)
        subscribe(code, set, get)
        return { result: 'ok', code }
      },

      joinRoom: async (rawCode) => {
        if (!isCollabConfigured()) return 'unconfigured'
        const sb = getSupabase()
        if (!sb) return 'unconfigured'
        const code = normalizeCode(rawCode)
        const { data, error } = await sb
          .from('shared_courses')
          .select('code, course, version, updated_at')
          .eq('code', code)
          .maybeSingle<SharedCourseRow>()
        if (error) {
          console.error('[collab.joinRoom]', error)
          return 'error'
        }
        if (!data) return 'not-found'
        const me = get().me
        const remote = data.course as Course
        // 참여자를 기여자 목록에 추가(없으면). 즉시 서버 반영은 publish 로.
        const contributors = remote.contributors?.some((c) => c.id === me.id)
          ? remote.contributors
          : [...(remote.contributors ?? []), me]
        const joined: Course = { ...remote, collabCode: code, contributors }
        set({ code, version: data.version, status: 'connecting' })
        useCourses.getState().setCurrent(joined)
        useCourses.getState().save(joined)
        subscribe(code, set, get)
        // 내 참여 사실을 서버에도 반영
        get().publish(joined)
        return 'ok'
      },

      publish: (course) => {
        const { code } = get()
        if (!code || !isCollabConfigured()) return
        if (pushTimer) clearTimeout(pushTimer)
        pushTimer = setTimeout(() => {
          void (async () => {
            const sb = getSupabase()
            if (!sb) return
            const nextVersion = get().version + 1
            const payload: Course = { ...course, collabCode: code, updatedAt: new Date().toISOString() }
            const { error } = await sb
              .from('shared_courses')
              .update({ course: payload, version: nextVersion, updated_at: payload.updatedAt })
              .eq('code', code)
            if (error) {
              console.error('[collab.publish]', error)
              return
            }
            set({ version: nextVersion })
          })()
        }, 350)
      },

      leaveRoom: () => {
        teardownChannel()
        set({ code: null, status: 'idle', peers: [], version: 0 })
      },
    }),
    {
      name: 'shimmaru.collab.v1',
      // 정체성(me)만 영구 저장. 방 연결 상태는 휘발.
      partialize: (s) => ({ me: s.me }),
    },
  ),
)

/** Realtime 구독 — 행 변경(postgres_changes) + 접속자(presence)를 구독한다. */
function subscribe(
  code: string,
  set: (partial: Partial<CollabState>) => void,
  get: () => CollabState,
) {
  const sb = getSupabase()
  if (!sb) return
  teardownChannel()
  const me = get().me
  channel = sb.channel(`course:${code}`, { config: { presence: { key: me.id } } })

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'shared_courses', filter: `code=eq.${code}` },
    (payload) => {
      const row = payload.new as SharedCourseRow | undefined
      if (!row || typeof row.version !== 'number') return
      // 내 쓰기 에코는 무시 — 더 높은 버전만 적용.
      if (row.version <= get().version) return
      const remote = row.course as Course
      const local = useCourses.getState().current
      // 같은 방 코스면 union 머지로 동시 편집 손실 완화, 아니면 원격 전체 채택.
      const next =
        local && local.collabCode === code ? mergeCourses(remote, local) : remote
      const merged: Course = { ...next, collabCode: code }
      set({ version: row.version })
      useCourses.getState().setCurrent(merged)
      useCourses.getState().save(merged)
    },
  )

  channel.on('presence', { event: 'sync' }, () => {
    if (!channel) return
    const state = channel.presenceState<{ name: string }>()
    const names = Object.values(state)
      .flat()
      .map((p) => p.name)
      .filter(Boolean)
    set({ peers: Array.from(new Set(names)) })
  })

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      set({ status: 'live' })
      void channel?.track({ name: get().me.name || '익명' })
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      set({ status: 'error' })
    }
  })
}
