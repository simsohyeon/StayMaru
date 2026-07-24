import type { ComponentType, SVGProps } from 'react'
import { SoloIcon, FriendsIcon, CoupleIcon, KidIcon, ElderIcon, PetIcon, AccessibleIcon } from '@/components/icons'
import type { Companion } from '@/types/domain'

/** 챗봇·빌더에서 노출할 동반자 선택지. label 은 i18n 키(home.chatbot.companions.*). */
export const COMPANIONS: { id: Companion; icon: ComponentType<SVGProps<SVGSVGElement>>; key: string }[] = [
  { id: 'solo',       icon: SoloIcon,       key: 'solo' },
  { id: 'friends',    icon: FriendsIcon,    key: 'friends' },
  { id: 'couple',     icon: CoupleIcon,     key: 'couple' },
  { id: 'kids',       icon: KidIcon,        key: 'kids' },
  { id: 'parents',    icon: ElderIcon,      key: 'parents' },
  { id: 'pet',        icon: PetIcon,        key: 'pet' },
  { id: 'accessible', icon: AccessibleIcon, key: 'accessible' },
]
