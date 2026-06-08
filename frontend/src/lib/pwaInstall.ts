import { useSyncExternalStore } from 'react'

/**
 * PWA 네이티브 설치 프롬프트 캡처.
 *
 * Chromium 계열(Android Chrome·데스크톱 Edge/Chrome)은 설치 가능 시점에
 * `beforeinstallprompt` 이벤트를 발생시킨다. 기본 동작을 막고 이벤트를 보관해 두었다가
 * 사용자가 "설치" 를 누른 순간 `prompt()` 로 네이티브 설치 시트를 띄운다 → 원탭 설치.
 *
 * iOS Safari 는 이 이벤트가 없으므로(공유→홈 화면에 추가 수동) AddToHomeDialog 가
 * 플랫폼별 수동 안내로 폴백한다.
 *
 * 이벤트는 React 마운트 이전에 발생할 수 있어 진입점(main.tsx)에서 import 만 해도
 * 모듈 로드 시 리스너가 즉시 붙도록 한다.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  prompt: () => Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

/** 네이티브 설치 프롬프트를 띄울 수 있는 상태인지 (Chromium 한정). */
export function canPromptInstall(): boolean {
  return deferred !== null
}

/** 이미 홈 화면/스탠드얼론으로 설치돼 실행 중인지. */
export function isInstalled(): boolean {
  if (installed) return true
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) {
    return true
  }
  // iOS Safari 의 비표준 standalone 플래그
  return typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true
}

/**
 * 네이티브 설치 프롬프트 실행. 사용자의 선택('accepted'|'dismissed')을 반환하고,
 * 프롬프트가 없으면(iOS 등) null 을 반환한다. 이벤트는 1회용이라 소비 후 폐기한다.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | null> {
  if (!deferred) return null
  const evt = deferred
  deferred = null
  emit()
  try {
    await evt.prompt()
    const choice = await evt.userChoice
    return choice.outcome
  } catch {
    return null
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** canPromptInstall() 의 변화를 구독하는 React 훅. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(subscribe, canPromptInstall, () => false)
}
