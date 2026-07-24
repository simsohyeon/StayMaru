import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchGyeongbukVisitors } from '@/api/bigdata'
import { findSigungu } from '@/constants/sigungu'
import { computeQuietRegions, staticQuietRegions, type QuietRegion } from '@/lib/hiddenIndex'
import type { Lang } from '@/types/domain'

/**
 * '숨은 경북 코스' — 제안서 최상위 약속(FR-04)을 데이터 근거와 함께 독립 진입점으로 노출.
 *
 * 한국관광공사 DataLab '외부 방문객' 통계로 한적지수(0~100)를 산출해 상위 시·군을 보여주고,
 * 그 지역들로 hidden_gb 프로필 코스를 즉시 생성한다. 라이브 데이터가 없으면 인구밀도 폴백으로
 * 항상 렌더된다. '왜 이 코스인가'를 사용자에게 그대로 보여주는 게 핵심.
 */
interface Props {
  lang: Lang
  generating: boolean
  /** 선택된 상위 한적 시·군 코드로 숨은 코스 생성 */
  onGenerate: (sigunguCodes: number[]) => void
}

const TOP_N = 5

export default function HiddenCourse({ lang, generating, onGenerate }: Props) {
  const { t } = useTranslation()
  const [regions, setRegions] = useState<QuietRegion[]>(() => staticQuietRegions())
  const [live, setLive] = useState(false)
  const [ym, setYm] = useState<string | undefined>()

  useEffect(() => {
    let alive = true
    void fetchGyeongbukVisitors().then((res) => {
      if (!alive) return
      if (res.status === 'ok' && res.items.length > 0) {
        setRegions(computeQuietRegions(res.items))
        setLive(true)
        setYm(res.baseYm)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  const top = regions.slice(0, TOP_N)
  const topCodes = top.map((r) => r.sigunguCode)
  const nameOf = (code: number) =>
    findSigungu(code)?.[lang as 'ko' | 'en' | 'ja' | 'zh'] ?? String(code)
  const source = live
    ? t('hidden.sourceLive', { ym: ym ? `${ym.slice(0, 4)}.${ym.slice(4, 6)}` : '' })
    : t('hidden.sourceStatic')

  return (
    <section className="section-pad">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">{t('hidden.eyebrow')}</p>
        <h2 className="section-title mt-1">{t('hidden.title')}</h2>
        <p className="mt-2 text-body-md text-body break-keep">{t('hidden.subtitle')}</p>

        <div className="card-pad mt-6">
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">{t('hidden.quietIndex')}</span>
            <span className="font-mono text-caption text-muted">{source}</span>
          </div>
          <ul className="mt-4 space-y-3">
            {top.map((r) => (
              <li key={r.sigunguCode} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-body-sm text-ink">{nameOf(r.sigunguCode)}</span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-pill bg-surface-strong/60">
                  <span
                    className="absolute inset-y-0 left-0 rounded-pill bg-primary"
                    style={{ width: `${r.quietScore}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-caption text-primary">
                  {r.quietScore}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-muted break-keep">{t('hidden.why')}</p>
          <button
            type="button"
            className="btn-primary mt-5 w-full"
            disabled={generating}
            onClick={() => onGenerate(topCodes)}
          >
            {t('hidden.cta')}
          </button>
        </div>
      </div>
    </section>
  )
}
