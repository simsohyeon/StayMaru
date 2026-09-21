import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 운영자 세션이 살아 있는지 — 메뉴에 '관리자'를 띄울지 판단하는 용도.
 *
 * 세션 쿠키는 HttpOnly 라 JS 가 읽을 수 없다. 서버에 물어보는 수밖에 없는데,
 * 일반 방문자 모두가 그 요청을 보낼 이유는 없다. 그래서 '이 브라우저에서 로그인한 적이 있다'는
 * 사실만 localStorage 에 남기고, 그 표식이 있을 때만 서버에 확인한다.
 *
 * 이 값은 권한이 아니라 화면 힌트다 — 표식을 손으로 켜 봐야 메뉴가 하나 보일 뿐,
 * 통계도 편집도 서버가 쿠키로 따로 막는다.
 */
interface AdminSessionState {
  /** 서버가 확인해 준(또는 방금 로그인한) 유효 세션 여부. */
  authed: boolean
  /** 로그인한 적 있는 브라우저인지 — 확인 요청을 보낼지 말지의 기준. */
  seen: boolean
  setAuthed: (v: boolean) => void
  verify: () => Promise<void>
}

let verified = false

export const useAdminSession = create<AdminSessionState>()(
  persist(
    (set, get) => ({
      authed: false,
      seen: false,
      setAuthed: (v) => set({ authed: v, seen: v || get().seen }),
      verify: async () => {
        if (verified || !get().seen) return
        verified = true
        try {
          const res = await fetch('/api/admin?action=session', { credentials: 'same-origin' })
          set({ authed: res.ok })
        } catch {
          /* 오프라인 — 지난 상태를 그대로 둔다. 눌러 봐야 서버가 다시 막는다. */
        }
      },
    }),
    { name: 'shimmaru-admin-session', version: 1, partialize: (s) => ({ authed: s.authed, seen: s.seen }) },
  ),
)
