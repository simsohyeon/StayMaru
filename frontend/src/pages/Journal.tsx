import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import Thumbnail from '@/components/Thumbnail'
import PassProgress from '@/components/PassProgress'
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
    <div className="page">
      <TopBar title={t('journal.title')} />

      <div className="page-body">
        <header className="journal__header">
          <p className="eyebrow">{t('journal.eyebrow')}</p>
          <h1 className="section-title journal__heading">{t('journal.heading')}</h1>
          <p className="journal__subtitle">
            {t('journal.subtitle')}
          </p>
        </header>

        <PassProgress entries={sorted} />

        {sorted.length === 0 ? (
          <div className="journal__empty">
            <p className="journal__empty-text">{t('journal.empty')}</p>
            <Link to="/explore" className="btn-secondary journal__empty-cta">
              {t('journal.exploreCta')} →
            </Link>
          </div>
        ) : (
          <>
            <div className="journal__summary">
              <span className="badge-soft">{sorted.length} {t('journal.entriesUnit')}</span>
              <span className="journal__summary-cat">
                {t('journal.countByCategory', {
                  count: new Set(sorted.map((e) => e.category)).size,
                })}
              </span>
            </div>

            <ul className="journal__list">
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
    <article className="card journal__card">
      <Link to={`/place/${entry.placeId}`} className="journal__card-link">
        <div className="journal__card-thumb">
          <Thumbnail src={entry.thumbnail} alt={entry.placeName} category={entry.category} />
        </div>
      </Link>
      <div className="journal__card-body">
        <CategoryBadge category={entry.category} lang={lang} />
        <h3 className="card-title journal__card-title">{entry.placeName}</h3>
        {entry.address && (
          <p className="journal__card-addr">{entry.address}</p>
        )}

        {editing ? (
          <div className="journal__edit">
            <label className="journal__field">
              <span className="journal__field-label">{t('journal.visitedAt')}</span>
              <input
                type="date"
                className="input journal__field-input"
                value={draft.visitedAt}
                onChange={(e) => setDraft({ ...draft, visitedAt: e.target.value })}
              />
            </label>
            <label className="journal__field">
              <span className="journal__field-label">{t('journal.rating')}</span>
              <div className="journal__stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft({ ...draft, rating: n })}
                    aria-label={t('journal.starAria', { n })}
                    aria-pressed={n <= draft.rating}
                    className={clsx(
                      'journal__star',
                      n <= draft.rating ? 'journal__star--on' : 'journal__star--off',
                    )}
                  >
                    {n <= draft.rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </label>
            <label className="journal__field">
              <span className="journal__field-label">{t('journal.note')}</span>
              <textarea
                rows={3}
                className="input journal__note-input"
                placeholder={t('journal.notePlaceholder')}
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
            </label>
            <div className="journal__edit-actions">
              <button type="button" onClick={save} className="btn-primary journal__save-btn">
                {t('common.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-secondary journal__cancel-btn"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="journal__meta">
              <span className="journal__date">{entry.visitedAt}</span>
              {entry.rating ? (
                <span className="journal__rating">
                  {'★'.repeat(entry.rating)}
                  <span className="journal__rating-empty">{'☆'.repeat(5 - entry.rating)}</span>
                </span>
              ) : null}
            </div>
            {entry.note && (
              <p className="journal__note">
                {entry.note}
              </p>
            )}
            <div className="journal__footer">
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
                className="journal__remove"
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
