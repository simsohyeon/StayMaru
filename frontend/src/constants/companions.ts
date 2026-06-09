import type { Companion } from '@/types/domain'

/** 챗봇·빌더에서 노출할 동반자 선택지. label 은 i18n 키(home.chatbot.companions.*). */
export const COMPANIONS: { id: Companion; emoji: string; key: string }[] = [
  { id: 'solo',       emoji: '🧍', key: 'solo' },
  { id: 'friends',    emoji: '👯', key: 'friends' },
  { id: 'couple',     emoji: '💑', key: 'couple' },
  { id: 'kids',       emoji: '🧒', key: 'kids' },
  { id: 'parents',    emoji: '👵', key: 'parents' },
  { id: 'pet',        emoji: '🐶', key: 'pet' },
  { id: 'accessible', emoji: '♿', key: 'accessible' },
]
