// 타입만 import — 값(createClient)은 아래에서 dynamic import 로 지연 로딩한다.
// 그래야 supabase-js(수백 KB)가 협업을 실제로 켜기 전까지 초기 번들에 실리지 않는다.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 코스 실시간 협업 백엔드 — Supabase.
 *
 * 로그인 없이 코스 키(=방 코드)만으로 친구와 같은 코스를 실시간 CRUD 한다.
 * anon key 는 공개 키라 번들 노출이 안전하고, RLS 가 shared_courses 만 익명 허용한다.
 * env(VITE_SUPABASE_URL / _ANON_KEY) 미설정이면 URL 링크 공유로 폴백해 앱이 깨지지 않는다.
 *
 * supabase-js 가 무거워 getSupabase() 는 첫 호출 때 dynamic import 한다 —
 * 이미 만들어진 클라이언트만 필요한 동기 경로(teardown 등)는 peekSupabase() 를 쓴다.
 * 테이블 스키마는 frontend/supabase.sql 참고.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null
let creating: Promise<SupabaseClient | null> | null = null

/** 실시간 협업이 설정돼 있는지 — env 두 값이 모두 있어야 true. */
export function isCollabConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** 이미 만들어진 클라이언트를 동기로 반환(없으면 null). teardown 등 생성 부작용 없이 접근할 때. */
export function peekSupabase(): SupabaseClient | null {
  return client
}

/**
 * lazy 싱글턴 클라이언트 — 첫 호출 때 supabase-js 를 dynamic import 한다.
 * 미설정이면 null (호출부에서 폴백 처리). 동시 호출은 생성 Promise 를 공유한다.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!isCollabConfigured()) return null
  if (client) return client
  if (!creating) {
    creating = import('@supabase/supabase-js').then(({ createClient }) => {
      client = createClient(url!, anonKey!, {
        auth: { persistSession: false }, // 로그인 없음 — 익명 사용
        realtime: { params: { eventsPerSecond: 5 } },
      })
      return client
    })
  }
  return creating
}

/** Supabase shared_courses 행 형태. course 는 Course JSON. */
export interface SharedCourseRow {
  code: string
  course: unknown
  version: number
  updated_at: string
}
