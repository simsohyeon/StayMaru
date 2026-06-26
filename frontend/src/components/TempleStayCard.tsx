import { useTranslation } from 'react-i18next'
import Thumbnail from './Thumbnail'
import type { Temple } from '@/api/templestay'

/**
 * templestay.com 사찰 카드.
 * 클릭 시 새 탭으로 templestay.com 사찰 프로그램 페이지로 이동한다.
 * 사찰 이미지는 관광공사 사찰 데이터에서 매칭한 firstimage (없으면 카테고리 이모지 폴백).
 */
export default function TempleStayCard({ temple }: { temple: Temple }) {
  const { t } = useTranslation()

  return (
    <a
      href={temple.reserveUrl}
      target="_blank"
      rel="noreferrer"
      className="card-hover temple-card"
    >
      <div className="temple-card__media">
        <Thumbnail src={temple.thumbnail} alt={temple.name} category="templestay" />
      </div>
      <div className="temple-card__body">
        <h3 className="temple-card__title">{temple.name}</h3>
        <p className="temple-card__cta">
          {t('place.reserve')} <span aria-hidden>↗</span>
        </p>
      </div>
    </a>
  )
}
