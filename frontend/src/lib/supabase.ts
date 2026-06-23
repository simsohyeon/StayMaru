import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * 코스 실시간 협업 백엔드 — Supabase.
 *
 * 로그인 없이(익명) 코스 키(=방 코드)만으로 친구와 같은 코스를 실시간 CRUD 한다.
 * anon key 는 공개 키라 프론트 번들 노출이 안전하며, RLS 로 shared_courses 테이블만 익명 허용한다.
 *
 * 환경변수 미설정 시 isCollabConfigured() === false → UI 는 기존 URL 링크 공유로 자동 폴백.
 * (공모전 심사자가 키 없이 열어도 앱이 깨지지 않도록 graceful degradation.)
 *
 * 필요한 env (frontend/.env.local 또는 배포 환경변수):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=eyJhb...
 *
 * 테이블 스키마는 frontend/supabase.sql 참고.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

/** 실시간 협업이 설정돼 있는지 — env 두 값이 모두 있어야 true. */
export function isCollabConfigured(): boolean {
  return Boolean(url && anonKey)
}

/** lazy 싱글턴 클라이언트. 미설정이면 null (호출부에서 폴백 처리). */
export function getSupabase(): SupabaseClient | null {
  if (!isCollabConfigured()) return null
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false }, // 로그인 없음 — 익명 사용
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}

/** Supabase shared_courses 행 형태. course 는 Course JSON. */
export interface SharedCourseRow {
  code: string
  course: unknown
  version: number
  updated_at: string
}
