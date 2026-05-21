import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildAreaUrl, buildReserveUrl, findTempleIdByName } from '@/api/templestay'
import type { Place } from '@/types/domain'

/**
 * 장소/축제 상세에서 연락처·예약·홈페이지를 큰 CTA 카드로 모아 보여준다.
 * - 전화: tel 우선, 없으면 infoCenter(안내·문의) 로 폴백
 * - 예약: bookingUrl > 카테고리 externalBookingUrl(예: templestay.com 사찰 검색) 순
 * - 홈페이지: 새 탭으로 외부 이동
 * - 부가 정보는 dl 로 정리된 행
 */
export default function ContactBlock({ place }: { place: Place }) {
  const { t } = useTranslation()

  const tel = place.tel?.trim() || place.infoCenter?.trim()
  const phoneHref = tel ? `tel:${tel.replace(/[^0-9+]/g, '')}` : undefined
  // tel 과 infoCenter 가 모두 있고 서로 다를 때만 부가 정보 행에 infoCenter 를 따로 표시
  const showSeparateInfoCenter =
    !!place.infoCenter?.trim() &&
    !!place.tel?.trim() &&
    place.tel.trim() !== place.infoCenter.trim()

  // 사찰/템플스테이 — templestay.com 의 실제 사찰 목록을 받아서 사찰명 정확 매칭.
  // 매칭 성공: templeId 파라미터로 해당 사찰 페이지로 직접 이동
  // 매칭 실패: 경북 area 전체 페이지 (지역 목록) 로 폴백
  const [templestayUrl, setTemplestayUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (place.category !== 'temple' && place.category !== 'templestay') {
      setTemplestayUrl(undefined)
      return
    }
    let cancelled = false
    void findTempleIdByName(place.name).then((id) => {
      if (cancelled) return
      setTemplestayUrl(id ? buildReserveUrl(id) : buildAreaUrl())
    })
    return () => {
      cancelled = true
    }
  }, [place.name, place.category])

  const bookingHref = place.bookingUrl || templestayUrl
  const bookingSub = bookingHref ? shortUrl(bookingHref) : undefined

  const hasPrimary = !!(phoneHref || bookingHref || place.homepage)

  return (
    <section className="card-pad space-y-5">
      <h3 className="eyebrow">{t('place.contactSection')}</h3>

      {hasPrimary ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {phoneHref && (
            <CtaButton href={phoneHref} icon="☎" label={t('place.callNow')} sub={tel} />
          )}
          {bookingHref && (
            <CtaButton
              href={bookingHref}
              icon="✦"
              label={t('place.reserve')}
              sub={bookingSub}
              external
              primary
            />
          )}
          {place.homepage && (
            <CtaButton
              href={place.homepage}
              icon="↗"
              label={t('place.visitWebsite')}
              sub={shortUrl(place.homepage)}
              external
            />
          )}
        </div>
      ) : (
        <p className="text-caption text-muted">{t('place.noContact')}</p>
      )}

      {place.bookingInfo && !place.bookingUrl && (
        <div className="rounded-md bg-canvas-soft border border-hairline-soft px-4 py-3 text-body-sm text-body">
          <span className="eyebrow mr-2">{t('place.booking')}</span>
          {place.bookingInfo}
        </div>
      )}

      <dl className="divide-y divide-hairline-soft text-sm">
        {showSeparateInfoCenter && place.infoCenter && (
          <Row label={t('place.infoCenter')}>
            <a
              href={`tel:${place.infoCenter.replace(/[^0-9+]/g, '')}`}
              className="text-ink underline-offset-4 hover:underline"
            >
              {place.infoCenter}
            </a>
          </Row>
        )}
        {place.address && <Row label={t('place.address')}>{place.address}</Row>}
        {place.openHours && <Row label={t('place.hours')}>{place.openHours}</Row>}
        {place.restDate && <Row label={t('place.restDate')}>{place.restDate}</Row>}
        {place.useFee && <Row label={t('place.useFee')}>{place.useFee}</Row>}
        {place.parking && <Row label={t('place.parking')}>{place.parking}</Row>}
        {place.sponsor && <Row label={t('place.sponsor')}>{place.sponsor}</Row>}
      </dl>
    </section>
  )
}

function CtaButton({
  href,
  icon,
  label,
  sub,
  external,
  primary,
}: {
  href: string
  icon: string
  label: string
  sub?: string
  external?: boolean
  primary?: boolean
}) {
  const base =
    'flex items-center gap-3 rounded-md px-4 h-14 transition-colors min-w-0'
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={
        primary
          ? `${base} bg-primary text-on-primary hover:bg-primary-active`
          : `${base} border border-hairline-strong bg-card text-ink hover:bg-canvas-soft`
      }
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-tight">{label}</div>
        {sub && (
          <div
            className={`mt-0.5 truncate font-mono text-[11px] leading-tight ${
              primary ? 'opacity-80' : 'text-muted'
            }`}
          >
            {sub}
          </div>
        )}
      </div>
      <span className={`shrink-0 text-sm ${primary ? 'opacity-70' : 'text-muted'}`}>→</span>
    </a>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-baseline gap-4 py-3">
      <dt className="text-eyebrow uppercase text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-body">{children}</dd>
    </div>
  )
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}

