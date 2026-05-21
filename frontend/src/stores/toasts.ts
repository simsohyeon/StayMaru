import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  type: ToastType
  message: string
  /** 추가 액션 라벨 (예: "보기"). 누르면 onAction 호출 후 dismiss. */
  actionLabel?: string
  onAction?: () => void
  /** ms — 기본 3000ms. 0이면 수동 닫기 전까지 유지. */
  duration: number
}

interface ToastState {
  toasts: Toast[]
  show: (message: string, opts?: Partial<Omit<Toast, 'id' | 'message'>>) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, opts) => {
    const id = nextId++
    const toast: Toast = {
      id,
      type: opts?.type ?? 'info',
      message,
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
      duration: opts?.duration ?? 3000,
    }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 짧은 글로벌 헬퍼 — alert 대체용. 컴포넌트 밖(콜백 안)에서도 호출 가능. */
export function toast(
  message: string,
  opts?: Partial<Omit<Toast, 'id' | 'message'>>,
): number {
  return useToasts.getState().show(message, opts)
}
