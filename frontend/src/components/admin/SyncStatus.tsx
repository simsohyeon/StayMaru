import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SIGUNGUS } from '@/constants/sigungu'
import { useSettings } from '@/stores/settings'

/**
 * 장소 적재 현황 — 경북 시군별로 Supabase 에 언제 적재됐는지 보여 준다.
 *
 * 왜 화면으로 두는가 — 적재가 비어 있으면 목록 조회가 전부 관광 API 로 나가고,
 * 일일 한도가 터지는 순간 카테고리 화면이 빈다. 그런데 적재 여부를 볼 방법이 없어
 * "왜 안 되는지" 를 배포 로그로도 알 수 없었다. 여기서 한눈에 확인한다.
 *
 * 값 자체는 서버가 내보내지 않는다 — 설정은 '있다/없다'만 온다.
 */
type SyncState = 'fresh' | 'stale' | 'missing'

interface SyncItem {
  sigunguCode: number
  syncedAt: string | null
  itemCount: number
  state: SyncState
}

interface SyncResponse {
  config: { supabase: boolean; tourApiKey: boolean; cronSecret: boolean }
  freshMs?: number
  total?: number
  fresh?: number
  items?: SyncItem[]
  error?: string
  reason?: string
  detail?: string
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: SyncResponse }

export default function SyncStatus() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const [view, setView] = useState<View>({ kind: 'loading' })

  const load = useCallback(async () => {
    setView({ kind: 'loading' })
    try {
      const res = await fetch('/api/admin?action=sync', { credentials: 'same-origin' })
      const data = (await res.json()) as SyncResponse
      // 503/502 도 config 는 담겨 온다 — 원인을 보여 줘야 하므로 그대로 그린다.
      setView({ kind: 'ready', data })
    } catch (err) {
      setView({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  // setState 를 effect 안에서 곧바로 부르지 않는다 — 중첩 async 로 감싸 커밋 이후로 미룬다.
  useEffect(() => {
    async function run() {
      await load()
    }
    void run()
  }, [load])

  if (view.kind === 'loading') return <p className="admin__status">{t('admin.loading')}</p>
  if (view.kind === 'error') {
    return (
      <div className="adm">
        <p className="admin__gate-error">{view.message}</p>
        <button type="button" className="btn-secondary" onClick={() => void load()}>
          {t('admin.retry')}
        </button>
      </div>
    )
  }

  const { config, items = [], fresh = 0, total = 0 } = view.data
  const name = (code: number) => SIGUNGUS.find((s) => s.code === code)?.[lang] ?? String(code)

  return (
    <section className="adm">
      <header className="adm__head">
        <h3 className="adm__title">{t('admin.sync.title')}</h3>
        <p className="adm__hint">{t('admin.sync.hint')}</p>
      </header>

      {/* 설정 점검 — 하나라도 빠지면 적재가 아예 안 돈다 */}
      <ul className="sync__config">
        {([
          ['supabase', config.supabase],
          ['tourApiKey', config.tourApiKey],
          ['cronSecret', config.cronSecret],
        ] as const).map(([key, ok]) => (
          <li key={key} className={ok ? 'sync__cfg sync__cfg--ok' : 'sync__cfg sync__cfg--off'}>
            <span className="sync__cfg-mark" aria-hidden>{ok ? '●' : '○'}</span>
            <span className="sync__cfg-name">{t(`admin.sync.cfg.${key}`)}</span>
            <span className="sync__cfg-state">{ok ? t('admin.sync.cfgOn') : t('admin.sync.cfgOff')}</span>
          </li>
        ))}
      </ul>
      {!config.cronSecret && <p className="sync__warn">{t('admin.sync.cronMissing')}</p>}

      {view.data.error ? (
        <p className="admin__gate-error">
          {view.data.reason === 'db-not-configured'
            ? t('admin.sync.dbMissing')
            : (view.data.detail ?? view.data.error)}
        </p>
      ) : (
        <>
          <p className="sync__summary">
            {t('admin.sync.coverage', { fresh, total })}
            {fresh < total && <span className="sync__summary-warn"> · {t('admin.sync.partial')}</span>}
          </p>

          <ul className="sync__grid">
            {items.map((it) => (
              <li key={it.sigunguCode} className={`sync__cell sync__cell--${it.state}`}>
                <span className="sync__cell-name">{name(it.sigunguCode)}</span>
                <span className="sync__cell-count">
                  {it.state === 'missing' ? t('admin.sync.never') : t('admin.sync.count', { n: it.itemCount })}
                </span>
                <span className="sync__cell-at">
                  {it.syncedAt ? new Date(it.syncedAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="adm__actions">
        <button type="button" className="btn-secondary" onClick={() => void load()}>
          {t('admin.sync.refresh')}
        </button>
      </div>
    </section>
  )
}
