import { create } from 'zustand'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** true 일 때 확정 버튼이 빨간 톤(파괴적 액션). */
  danger?: boolean
}

interface ConfirmRequest extends ConfirmOptions {
  id: number
  resolve: (ok: boolean) => void
}

interface ConfirmState {
  current: ConfirmRequest | null
  ask: (opts: ConfirmOptions) => Promise<boolean>
  resolve: (ok: boolean) => void
}

let nextId = 1

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  current: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      const id = nextId++
      // 기존에 떠 있는 다이얼로그가 있으면 자동 취소(false) 후 새 요청 표시.
      const prev = get().current
      if (prev) prev.resolve(false)
      set({ current: { ...opts, id, resolve } })
    }),
  resolve: (ok) => {
    const cur = get().current
    if (!cur) return
    cur.resolve(ok)
    set({ current: null })
  },
}))

/** native `confirm()` 대체 — Promise<boolean>. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(opts)
}
