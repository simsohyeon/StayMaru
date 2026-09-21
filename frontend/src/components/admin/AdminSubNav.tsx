import { useTranslation } from 'react-i18next'
import KhsSubNav from '@/components/khs/KhsSubNav'

/**
 * 운영자 화면 좌측 레일 — 「내 여행」과 같은 구조.
 *
 * 지금은 '테마 관리' 하나뿐이지만, 운영자가 손볼 화면이 늘면 여기에 한 줄씩 더하면 된다
 * (예: 배너 관리 → { label: t('admin.nav.banner'), to: '/admin/banner' }).
 * 새 항목은 routes.tsx 에 같은 경로를 등록하고 Admin 이 그 화면을 고르게 하면 된다.
 */
export default function AdminSubNav() {
  const { t } = useTranslation()
  return (
    <KhsSubNav
      title={t('khs.gnb.admin')}
      items={[{ label: t('admin.navCurated'), to: '/admin', end: true }]}
    />
  )
}
