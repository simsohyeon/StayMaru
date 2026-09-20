import { useTranslation } from 'react-i18next'
import KhsSubNav from '@/components/khs/KhsSubNav'
import { useFavorites } from '@/stores/favorites'
import { useCourses } from '@/stores/courses'

/** 「내 여행」 그룹(내 여행 홈·찜 목록·저장 코스·설정) 공용 레일 — 찜/코스 개수를 함께 보인다. */
export default function MySubNav() {
  const { t } = useTranslation()
  const places = useFavorites((s) => s.places)
  const festivals = useFavorites((s) => s.festivals)
  const saved = useCourses((s) => s.saved)
  return (
    <KhsSubNav
      title={t('khs.gnb.my')}
      items={[
        { label: t('my.home'), to: '/my', end: true },
        { label: t('favorites.title'), to: '/favorites', count: places.length + festivals.length },
        { label: t('favorites.courses'), to: '/favorites?tab=courses', count: saved.length },
        { label: t('nav.settings'), to: '/settings' },
      ]}
    />
  )
}
