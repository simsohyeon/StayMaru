import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import { useCourses } from '@/stores/courses'
import { useFavorites } from '@/stores/favorites'
import { findSigungu } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'

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
    <div className="bg-canvas">
      <TopBar title={t('admin.title')} back />
      <div className="px-5 py-8 md:px-10 md:py-12 grid gap-5 md:grid-cols-2">
        <Card title={t('admin.coursesGenerated')} value={`${saved.length} / ${recent.length}`} />
        <Card title={t('admin.favoritePlaces')} value={`${favPlaces.length}`} />

        <Section title={t('admin.popularByRegion')}>
          {byRegion.length === 0 ? <Empty /> : (
            <ul className="divide-y divide-hairline">
              {byRegion.slice(0, 10).map(([code, n]) => {
                const sg = code ? findSigungu(Number(code)) : undefined
                const name = sg ? sg[lang as 'ko' | 'en' | 'ja' | 'zh'] : t('admin.unknown')
                return (
                  <li key={code} className="flex justify-between py-3">
                    <span className="text-body">{name}</span>
                    <span className="font-mono text-ink">{n}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title={t('admin.favoriteCategory')}>
          {byCategory.length === 0 ? <Empty /> : (
            <ul className="divide-y divide-hairline">
              {byCategory.map(([k, n]) => (
                <li key={k} className="flex justify-between py-3">
                  <span className="text-body">{k}</span>
                  <span className="font-mono text-ink">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('admin.usageByLang')}>
          {byLang.length === 0 ? <Empty /> : (
            <ul className="divide-y divide-hairline">
              {byLang.map(([k, n]) => (
                <li key={k} className="flex justify-between py-3">
                  <span className="text-body">{k}</span>
                  <span className="font-mono text-ink">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="md:col-span-2 font-mono text-caption text-muted">
          {t('admin.note')}
        </p>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-pad flex items-baseline justify-between">
      <div className="eyebrow">{title}</div>
      <div className="font-display text-display-md text-ink" style={{ fontWeight: 400 }}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-pad">
      <h3 className="eyebrow">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty() {
  const { t } = useTranslation()
  return <p className="py-6 text-center text-caption text-muted">{t('admin.noData')}</p>
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
