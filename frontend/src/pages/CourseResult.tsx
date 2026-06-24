import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import clsx from 'clsx'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { PROFILE_LABELS } from '@/constants/categories'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import AddToHomeDialog from '@/components/AddToHomeDialog'
import { encodeShare, shareOrCopy, toastForShareResult } from '@/lib/share'
import { recomputeCourse, reoptimizeCourse, toggleVote } from '@/lib/courseEngine'
import { useCollab } from '@/stores/collab'
import CollabPanel from '@/components/CollabPanel'
import { useToasts } from '@/stores/toasts'
import type { CollabContributor, Course, CourseItem } from '@/types/domain'
import { calcSlowIndex } from '@/lib/slowIndex'
import { isVisitorDataActive, visitorDataBaseYm } from '@/lib/visitorIndex'
import {
  segmentCarMinutes,
  segmentTransitMinutes,
  totalCarMinutes,
  totalTransitMinutes,
} from '@/lib/travelTime'

export default function CourseResult() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const course = useCourses((s) => s.current)
  const save = useCourses((s) => s.save)
  const setCurrent = useCourses((s) => s.setCurrent)
  const saved = useCourses((s) => s.saved)
  const isSaved = course ? saved.some((c) => c.id === course.id) : false
  const pushToast = useToasts((s) => s.show)
  const meId = useCollab((s) => s.me.id)
  const publish = useCollab((s) => s.publish)
  const favPlaces = useFavorites((s) => s.places)
  const [addHomeOpen, setAddHomeOpen] = useState(false)
  // 인라인 편집 모드 — 결과 화면을 떠나지 않고 그 자리에서 순서변경·삭제·추가·제목수정.
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 협업 — 기여자 id → 기여자(이름·색) 조회 맵
  const contributorById = useMemo(() => {
    const m = new Map<string, CollabContributor>()
    for (const c of course?.contributors ?? []) m.set(c.id, c)
    return m
  }, [course])

  // 하트 투표 토글 — 코스를 갱신하고 협업 중이면 서버에 반영(publish).
  function handleVote(placeId: string) {
    if (!course) return
    const updated = toggleVote(course, placeId, meId)
    setCurrent(updated)
    save(updated)
    publish(updated)
  }

  // 코스 공유 URL — 홈 화면에 추가 시 사용자가 다시 같은 코스로 진입.
  const shareUrl = useMemo(
    () => (course ? `${location.origin}/course/shared/${encodeShare(course)}` : ''),
    [course],
  )

  // document.title 을 코스 제목으로 — OS 의 '홈 화면에 추가' 라벨에 자동 반영된다.
  useEffect(() => {
    if (!course) return
    const prev = document.title
    document.title = `${course.title} · ${t('appName')}`
    return () => {
      document.title = prev
    }
  }, [course, t])

  if (!course) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center px-5">
          <p className="text-body-md text-muted">{t('course.empty')}</p>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('home.generate')}
          </button>
        </div>
      </div>
    )
  }

  // 빈 결과 — generateCourse 가 emptyCourse 를 반환한 경우. 사용자에게 다음 행동 안내.
  if (course.items.length === 0) {
    return (
      <div className="bg-canvas">
        <TopBar back />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center px-5 py-16">
          <span className="text-5xl" aria-hidden>
            🗺️
          </span>
          <div className="max-w-md space-y-3">
            <h2 className="font-display text-display-sm text-ink">{t('course.emptyItemsTitle')}</h2>
            <p className="text-body-md text-body break-keep">{t('course.emptyItemsBody')}</p>
          </div>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('course.regenerateCta')}
          </button>
        </div>
      </div>
    )
  }

  async function handleShare() {
    if (!course) return
    // 카카오 Feed 카드용 — 첫 장소 썸네일을 대표 이미지로, 코스 통계를 설명으로.
    const heroImage = course.items[0]?.place.thumbnail
    const description = `${course.items.length}${t('course.visitedUnit')} · ${course.totalDistanceKm}${t('course.km')} · ${course.estimatedTravelMinutes}${t('course.min')}`
    const r = await shareOrCopy({
      title: course.title,
      text: description,
      url: shareUrl,
      imageUrl: heroImage,
    })
    toastForShareResult(r, t, pushToast)
  }

  function handleSave() {
    if (!course) return
    const wasSaved = isSaved
    save(course)
    setCurrent(course)
    if (!wasSaved) {
      // 저장 직후 — 홈 화면 바로가기 옵션을 토스트 액션으로 안내.
      pushToast(t('course.savedToast'), {
        type: 'success',
        duration: 5000,
        actionLabel: t('course.addToHome'),
        onAction: () => setAddHomeOpen(true),
      })
    }
  }

  // ── 인라인 편집 — 변경마다 거리 재계산 후 저장·협업 반영(라이브) ──
  function applyCourse(next: Course) {
    const r = recomputeCourse(next)
    setCurrent(r)
    save(r)
    publish(r)
  }

  function handleDragEnd(e: DragEndEvent) {
    if (!course) return
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = course.items.findIndex((i) => i.place.id === active.id)
    const newIdx = course.items.findIndex((i) => i.place.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    applyCourse({ ...course, items: arrayMove(course.items, oldIdx, newIdx) })
  }

  function removeItem(id: string) {
    if (!course) return
    applyCourse({ ...course, items: course.items.filter((i) => i.place.id !== id) })
  }

  function addFavorite(idx: number) {
    if (!course) return
    const fav = favPlaces[idx]
    if (course.items.some((i) => i.place.id === fav.id)) return
    const item: CourseItem = { place: fav, order: course.items.length + 1, distanceFromPrevKm: 0, addedBy: meId }
    applyCourse({ ...course, items: [...course.items, item] })
  }

  function handleReoptimize() {
    if (!course) return
    const opt = reoptimizeCourse(course)
    setCurrent(opt)
    save(opt)
    publish(opt)
    pushToast(t('collab.reoptimized', { km: opt.totalDistanceKm }), { type: 'success' })
  }

  function toggleEdit() {
    if (!course) return
    if (!editing) setTitleDraft(course.title)
    setEditing((v) => !v)
  }

  function commitTitle() {
    if (!course) return
    const next = titleDraft.trim()
    if (!next || next === course.title) return
    applyCourse({ ...course, title: next })
  }

  return (
    <div className="bg-canvas">
      <TopBar
        back
        right={
          <button
            type="button"
            aria-label={t('course.share')}
            onClick={() => void handleShare()}
            className="font-mono text-xs text-muted hover:text-ink"
          >
            {t('course.share')}
          </button>
        }
      />

      <div className="px-5 py-8 md:px-10 md:py-12 space-y-10">
        <header>
          <p className="eyebrow">{t('course.headerEyebrow')}</p>
          {editing ? (
            <input
              type="text"
              className="input mt-3 text-display-sm"
              value={titleDraft}
              placeholder={t('course.titlePlaceholder')}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
            />
          ) : (
            <h1 className="mt-3 text-display-lg text-ink">{course.title}</h1>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {course.profile && (
              <span className="badge">{PROFILE_LABELS[course.profile][lang]}</span>
            )}
            {course.hiddenMode && <span className="badge">{t('regions.hiddenBadge')}</span>}
          </div>
        </header>

        {/* stats — 거리, 자차/대중교통 추정, 방문지 */}
        {(() => {
          const distances = course.items.map((it) => it.distanceFromPrevKm)
          const carMin = totalCarMinutes(distances)
          const transitMin = totalTransitMinutes(distances)
          return (
            <div className="card-pad grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat
                label={t('course.distance')}
                value={`${course.totalDistanceKm}`}
                unit={t('course.km')}
              />
              <Stat
                label={`🚗 ${t('course.byCar')}`}
                value={`${carMin}`}
                unit={t('course.min')}
              />
              <Stat
                label={`🚌 ${t('course.byTransit')}`}
                value={`${transitMin}`}
                unit={t('course.min')}
              />
              <Stat
                label={t('course.visited')}
                value={`${course.items.length}`}
                unit={t('course.visitedUnit')}
              />
            </div>
          )
        })()}

        <SlowIndexCard course={course} />

        {/* 실시간 협업 — 코스 키(방 코드)로 친구와 같이 CRUD */}
        <CollabPanel course={course} shareUrl={shareUrl} />

        {/* Map (IDE-pane analog) + List */}
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start print-list-only">
          <div className="md:sticky md:top-20 print-hide">
            <KakaoMap course={course} className="h-64 w-full md:h-[480px]" />
          </div>

          {editing ? (
            <div className="space-y-4">
              <p className="font-mono text-caption text-muted">{t('course.reorderHint')}</p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={course.items.map((i) => i.place.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-3">
                    {course.items.map((it, i) => (
                      <SortableEditRow
                        key={it.place.id}
                        item={it}
                        index={i + 1}
                        lang={lang}
                        contributor={it.addedBy ? contributorById.get(it.addedBy) : undefined}
                        onRemove={() => removeItem(it.place.id)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
              {favPlaces.length > 0 && (
                <section className="surface-pane">
                  <p className="eyebrow text-muted-soft">
                    {t('favorites.places')} → {t('course.addPlace')}
                  </p>
                  <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 scrollbar-hide">
                    {favPlaces.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        className="chip disabled:opacity-40"
                        disabled={course!.items.some((i) => i.place.id === p.id)}
                        onClick={() => addFavorite(idx)}
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <ol className="space-y-3 md:col-span-1 print:col-span-2">
            {course.items.map((it) => (
              <li
                key={it.place.id}
                className="card-hover flex gap-4 overflow-hidden p-4 cursor-pointer"
                onClick={() => nav(`/place/${it.place.id}`, { state: { place: it.place } })}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-ink font-mono text-sm text-canvas">
                  {String(it.order).padStart(2, '0')}
                </div>
                <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded-md">
                  <Thumbnail src={it.place.thumbnail} alt={it.place.name} category={it.place.category} compact />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CategoryBadge category={it.place.category} lang={lang} />
                      {/* 여행 릴레이 — 이 장소를 추가한 기여자 태그 */}
                      {it.addedBy && contributorById.get(it.addedBy) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: contributorById.get(it.addedBy)!.color }}
                          title={t('collab.addedBy', { name: contributorById.get(it.addedBy)!.name })}
                        >
                          {contributorById.get(it.addedBy)!.name || t('collab.anon')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-title-sm text-ink truncate">{it.place.name}</div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {it.order > 1 ? (
                      <p className="font-mono text-[11px] text-muted whitespace-nowrap">
                        +{it.distanceFromPrevKm}{t('course.km')}
                        <span className="mx-1.5 text-muted-soft">·</span>
                        🚗 {segmentCarMinutes(it.distanceFromPrevKm)}{t('course.min')}
                        <span className="mx-1.5 text-muted-soft">·</span>
                        🚌 {segmentTransitMinutes(it.distanceFromPrevKm)}{t('course.min')}
                      </p>
                    ) : (
                      <span />
                    )}
                    {/* 하트 투표 — 협업 중일 때만 노출 */}
                    {course.collabCode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVote(it.place.id)
                        }}
                        className={clsx(
                          'inline-flex flex-shrink-0 items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-semibold transition-colors',
                          (it.votes ?? []).includes(meId)
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-hairline bg-card text-muted hover:text-rose-600',
                        )}
                        aria-pressed={(it.votes ?? []).includes(meId)}
                        aria-label={t('collab.vote')}
                      >
                        {(it.votes ?? []).includes(meId) ? '♥' : '♡'} {(it.votes ?? []).length || ''}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
            </ol>
          )}
        </div>

        {/* actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-6 print-hide">
          <button type="button" className="btn-secondary" onClick={() => nav('/course/map')}>
            {t('course.viewMap')}
          </button>
          <button
            type="button"
            className={editing ? 'btn-download' : 'btn-secondary'}
            onClick={toggleEdit}
          >
            {editing ? '✓ ' + t('collab.done') : '✎ ' + t('course.edit')}
          </button>
          {editing && course.items.length >= 3 && (
            <button type="button" className="btn-secondary" onClick={handleReoptimize}>
              <span aria-hidden>⤳</span> {t('collab.reoptimize')}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => window.print()}
            title={t('course.pdfHint')}
          >
            📄 {t('course.savePdf')}
          </button>
          <span className="font-mono text-[11px] text-muted-soft hidden md:inline">
            {t('course.pdfHint')}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setAddHomeOpen(true)}
            title={t('course.addToHomeHint')}
          >
            📱 {t('course.addToHome')}
          </button>
          <button
            type="button"
            className={isSaved ? 'btn-secondary' : 'btn-download'}
            onClick={handleSave}
          >
            {isSaved ? '✓ ' + t('course.saved') : t('course.save')}
          </button>
        </div>
      </div>

      <AddToHomeDialog
        open={addHomeOpen}
        onClose={() => setAddHomeOpen(false)}
        title={course.title}
        url={shareUrl}
      />
    </div>
  )
}

/** 인라인 편집 모드의 정렬 가능 행 — 드래그 핸들 + 기여자 태그 + 삭제. */
function SortableEditRow({
  item,
  index,
  lang,
  contributor,
  onRemove,
}: {
  item: CourseItem
  index: number
  lang: 'ko' | 'en' | 'ja' | 'zh'
  contributor?: CollabContributor
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.place.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`card flex gap-4 p-4 ${isDragging ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        className="cursor-grab text-muted active:cursor-grabbing"
        aria-label={t('common.drag')}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-ink font-mono text-sm text-canvas">
        {String(index).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <CategoryBadge category={item.place.category} lang={lang} />
          {contributor && (
            <span
              className="inline-flex items-center rounded-pill px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: contributor.color }}
            >
              {contributor.name}
            </span>
          )}
        </div>
        <div className="mt-1.5 text-title-sm text-ink truncate">{item.place.name}</div>
        <p className="text-caption text-muted truncate">{item.place.address}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="font-mono text-[11px] text-muted hover:text-ink"
      >
        {t('course.remove')}
      </button>
    </li>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="font-display text-display-md text-ink" style={{ fontWeight: 400 }}>{value}</span>
        <span className="text-caption text-muted">{unit}</span>
      </p>
    </div>
  )
}

/**
 * Slow Travel Index 카드 — 쉼마루의 정체성을 시각화한다.
 * 머무름 지수와 한적 지수를 0~10 막대로 보여주고, 종합 라벨(쉼형/균형형/활동형)을 함께 노출.
 */
function SlowIndexCard({ course }: { course: import('@/types/domain').Course }) {
  const { t } = useTranslation()
  const idx = calcSlowIndex(course)
  const labelTone: Record<typeof idx.label, string> = {
    slow: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    balanced: 'bg-amber-50 text-amber-800 border-amber-200',
    busy: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  return (
    <section className="card-pad space-y-5">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">{t('course.slow.eyebrow')}</p>
          <h2 className="mt-1 font-display text-display-sm text-ink">
            {t('course.slow.title')}
          </h2>
          <p className="mt-2 text-caption text-muted max-w-md">
            {t('course.slow.body')}
          </p>
        </div>
        <span
          className={clsx(
            'inline-flex items-center gap-2 rounded-pill border px-3 py-1 text-xs font-semibold',
            labelTone[idx.label],
          )}
        >
          <span className="font-mono uppercase tracking-wider">
            {t(`course.slow.${idx.label}`)}
          </span>
        </span>
      </header>
      <div className="grid gap-5 md:grid-cols-2">
        <ScoreBar
          label={t('course.slow.stayLabel')}
          score={idx.stayScore}
          hint={t('course.slow.stayHint', {
            stay: idx.totalStayMinutes,
            travel: idx.totalTravelMinutes,
          })}
          tone="emerald"
        />
        <ScoreBar
          label={t('course.slow.quietLabel')}
          score={idx.quietScore}
          hint={t('course.slow.quietHint')}
          tone="sky"
        />
      </div>
      {isVisitorDataActive() && (
        <p className="flex items-center gap-1.5 text-caption text-muted-soft">
          <span aria-hidden>◆</span>
          {t('course.slow.dataLabSource', { ym: formatYm(visitorDataBaseYm()) })}
        </p>
      )}
    </section>
  )
}

/** "202512" → "2025.12". baseYm 미상이면 빈 문자열. */
function formatYm(ym?: string): string {
  if (!ym || ym.length !== 6) return ''
  return `${ym.slice(0, 4)}.${ym.slice(4, 6)}`
}

function ScoreBar({
  label,
  score,
  hint,
  tone,
}: {
  label: string
  score: number
  hint: string
  tone: 'emerald' | 'sky'
}) {
  const barClass = tone === 'emerald' ? 'bg-emerald-500' : 'bg-sky-500'
  const pct = Math.max(2, Math.min(100, score * 10))
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-title-md text-ink">
          {score.toFixed(1)} <span className="text-caption text-muted">/ 10</span>
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-canvas-soft">
        <div
          className={clsx('h-full rounded-full transition-all', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-caption text-muted-soft">{hint}</p>
    </div>
  )
}
