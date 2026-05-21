import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import { useJournal, type JournalEntry } from '@/stores/journal'
import { useSettings } from '@/stores/settings'
import { askConfirm } from '@/stores/confirm'

export default function Journal() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const entries = useJournal((s) => s.entries)
  const update = useJournal((s) => s.update)
  const remove = useJournal((s) => s.remove)

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.visitedAt.localeCompare(a.visitedAt)),
    [entries],
  )

  return (
    <div className="bg-canvas">
      <TopBar title={t('journal.title')} />

      <div className="px-5 py-8 md:px-10 md:py-12">
        <header className="max-w-2xl">
          <p className="eyebrow">{t('journal.eyebrow')}</p>
          <h1 className="mt-3 section-title">{t('journal.heading')}</h1>
          <p className="mt-3 text-body-md text-body">
            {t('journal.subtitle')}
          </p>
        </header>

        {sorted.length === 0 ? (
          <div className="mt-10 rounded-lg border border-hairline bg-canvas-soft p-10 text-center">
            <p className="text-body-md text-muted">{t('journal.empty')}</p>
            <Link to="/explore" className="btn-secondary mt-4 inline-block">
              {t('journal.exploreCta')} →
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <span className="badge-soft">{sorted.length} {t('journal.entriesUnit')}</span>
              <span className="font-mono text-caption text-muted-soft">
                {t('journal.countByCategory', {
                  count: new Set(sorted.map((e) => e.category)).size,
                })}
              </span>
            </div>

            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sorted.map((e) => (
                <li key={e.placeId}>
                  <JournalCard
                    entry={e}
                    lang={lang}
                    onUpdate={(patch) => update(e.placeId, patch)}
                    onRemove={() => remove(e.placeId)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function JournalCard({
  entry,
  lang,
  onUpdate,
  onRemove,
}: {
  entry: JournalEntry
  lang: 'ko' | 'en' | 'ja' | 'zh'
  onUpdate: (patch: Partial<JournalEntry>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    visitedAt: entry.visitedAt,
    note: entry.note ?? '',
    rating: entry.rating ?? 0,
  })

  function save() {
    onUpdate(draft)
    setEditing(false)
  }

  return (
    <article className="card overflow-hidden flex flex-col">
      <Link to={`/place/${entry.placeId}`} className="block">
        <div className="aspect-[16/9] w-full overflow-hidden">
          <Thumbnail src={entry.thumbnail} alt={entry.placeName} category={entry.category} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <CategoryBadge category={entry.category} lang={lang} />
        <h3 className="mt-3 text-title-md text-ink truncate">{entry.placeName}</h3>
        {entry.address && (
          <p className="mt-1 text-caption text-muted truncate">{entry.address}</p>
        )}

        {editing ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-caption text-muted">{t('journal.visitedAt')}</span>
              <input
                type="date"
                className="input mt-1"
                value={draft.visitedAt}
                onChange={(e) => setDraft({ ...draft, visitedAt: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-caption text-muted">{t('journal.rating')}</span>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft({ ...draft, rating: n })}
                    className={clsx(
                      'text-2xl leading-none',
                      n <= draft.rating ? 'text-amber-500' : 'text-muted-soft',
                    )}
                  >
                    {n <= draft.rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </label>
            <label className="block">
              <span className="text-caption text-muted">{t('journal.note')}</span>
              <textarea
                rows={3}
                className="input mt-1 resize-none"
                placeholder={t('journal.notePlaceholder')}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={save} className="btn-primary !h-9 !px-4 !text-xs flex-1">
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-secondary !h-9 !px-4 !text-xs"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="font-mono text-caption text-primary">{entry.visitedAt}</span>
              {entry.rating ? (
                <span className="text-amber-500 text-sm">
                  {'★'.repeat(entry.rating)}
                  <span className="text-muted-soft">{'☆'.repeat(5 - entry.rating)}</span>
                </span>
              ) : null}
            </div>
            {entry.note && (
              <p className="mt-3 text-body-sm text-body line-clamp-3 whitespace-pre-line">
                {entry.note}
              </p>
            )}
            <div className="mt-auto pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-text"
              >
                {t('journal.edit')} →
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await askConfirm({
                    message: t('journal.removeConfirm'),
                    danger: true,
                    confirmLabel: t('journal.remove'),
                  })
                  if (ok) onRemove()
                }}
                className="ml-auto font-mono text-caption text-muted-soft hover:text-rose-500"
              >
                {t('journal.remove')}
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  )
}
