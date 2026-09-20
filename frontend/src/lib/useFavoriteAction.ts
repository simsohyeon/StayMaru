import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFavorites } from '@/stores/favorites'
import { toast } from '@/stores/toasts'
import type { Festival, Place } from '@/types/domain'

/**
 * Toggle 결과를 토스트로 알리는 래퍼 — 저장은 확인 토스트, 해제는 undo 토스트.
 * 찜이 "내 여행에 담기"의 유일한 동작이라 담겼는지 눈에 보여야 한다(토스트는 화면 상단).
 *
 * 사용: const togglePlace = useToggleFavorite(); togglePlace(place);
 */
export function useToggleFavorite() {
  const { t } = useTranslation()
  const toggleplace = useFavorites((s) => s.toggleplace)
  const togglefestival = useFavorites((s) => s.togglefestival)
  const undoRemove = useFavorites.getState().undoRemove

  const togglePlace = useCallback(
    (p: Place) => {
      const wasFav = useFavorites.getState().places.some((x) => x.id === p.id)
      toggleplace(p)
      if (wasFav) {
        toast(t('favorites.unsavedToast'), {
          type: 'info',
          actionLabel: t('common.undo'),
          onAction: undoRemove,
        })
      } else {
        toast(t('favorites.savedToast'), { type: 'success' })
      }
    },
    [t, toggleplace, undoRemove],
  )

  const toggleFestival = useCallback(
    (f: Festival) => {
      const wasFav = useFavorites.getState().festivals.some((x) => x.id === f.id)
      togglefestival(f)
      if (wasFav) {
        toast(t('favorites.unsavedToast'), {
          type: 'info',
          actionLabel: t('common.undo'),
          onAction: undoRemove,
        })
      } else {
        toast(t('favorites.savedToast'), { type: 'success' })
      }
    },
    [t, togglefestival, undoRemove],
  )

  return { togglePlace, toggleFestival }
}
