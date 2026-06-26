import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import { useCourses } from '@/stores/courses'
import { useFavorites } from '@/stores/favorites'
import { findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'
import { CATEGORY_MAP } from '@/constants/categories'
import type { CategoryId } from '@/types/domain'

// 언어 코드 → 모국어 표기 (언어 통계용)
const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  zh: '中文',
}

export default function Admin() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const saved = useCourses((s) => s.saved)
  const recent = useCourses((s) => s.recent)
  const favPlaces = useFavorites((s) => s.places)

  const byRegion = aggregateRegions(saved.flatMap((c) => c.items.map((i) => i.place.sigunguCode)))
  const byCategory = aggregate(favPlaces.map((p) => p.category))
  const byLang = aggregate(saved.map((c) => c.lang))

  return (
    <div className="page">
      <TopBar title={t('admin.title')} back />
      <div className="page-body admin__body">
        <Card title={t('admin.coursesGenerated')} value={`${saved.length} / ${recent.length}`} />
        <Card title={t('admin.favoritePlaces')} value={`${favPlaces.length}`} />

        <Section title={t('admin.popularByRegion')}>
          {byRegion.length === 0 ? <Empty /> : (
            <ul className="admin__list">
              {byRegion.slice(0, 10).map(([code, n]) => {
                const sg = code ? findSigungu(Number(code)) : undefined
                const name = sg ? sg[lang as 'ko' | 'en' | 'ja' | 'zh'] : t('admin.unknown')
                return (
                  <li key={code} className="admin__row">
                    <span className="admin__row-label">{name}</span>
                    <span className="admin__row-value">{n}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title={t('admin.favoriteCategory')}>
          {byCategory.length === 0 ? <Empty /> : (
            <ul className="admin__list">
              {byCategory.map(([k, n]) => (
                <li key={k} className="admin__row">
                  <span className="admin__row-label">
                    {CATEGORY_MAP[k as CategoryId]?.label[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? k}
                  </span>
                  <span className="admin__row-value">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('admin.usageByLang')}>
          {byLang.length === 0 ? <Empty /> : (
            <ul className="admin__list">
              {byLang.map(([k, n]) => (
                <li key={k} className="admin__row">
                  <span className="admin__row-label">{LANG_NAMES[k] ?? k}</span>
                  <span className="admin__row-value">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="admin__note">
          {t('admin.note')}
        </p>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-pad admin__card">
      <div className="eyebrow">{title}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-pad">
      <h3 className="eyebrow">{title}</h3>
      <div className="admin__section-body">{children}</div>
    </section>
  )
}

function Empty() {
  const { t } = useTranslation()
  return <p className="admin__empty">{t('admin.noData')}</p>
}

function aggregate<T>(arr: T[]): [string, number][] {
  const m = new Map<string, number>()
  for (const v of arr) {
    const k = String(v ?? '')
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function aggregateRegions(arr: (number | undefined)[]): [string, number][] {
  return aggregate(arr.filter((x): x is number => !!x).map(String))
}
