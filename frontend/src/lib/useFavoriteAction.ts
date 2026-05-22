import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useFavorites } from '@/stores/favorites'
import { toast } from '@/stores/toasts'
import type { Festival, Place } from '@/types/domain'

/**
 * Toggle 후 "해제" 케이스에만 undo 토스트를 띄우는 래퍼.
 * 별 한 번 잘못 눌렀을 때 즉시 되돌릴 수 있게 한다.
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
      }
    },
    [t, togglefestival, undoRemove],
  )

  return { togglePlace, toggleFestival }
}
