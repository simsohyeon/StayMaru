import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import { CarIcon, TransitIcon, PencilIcon, RouteIcon, CheckIcon, HandshakeIcon, SparkleIcon, MapIcon, DocumentIcon, FestivalIcon, HeartIcon, CloseIcon, MobileIcon } from '@/components/icons'
import KakaoMap from '@/components/KakaoMap'
import Thumbnail from '@/components/Thumbnail'
import AddToHomeDialog from '@/components/AddToHomeDialog'
import { encodeShare, shareOrCopy, toastForShareResult } from '@/lib/share'
import { recomputeCourse, reoptimizeCourse, toggleVote } from '@/lib/courseEngine'
import { useCollab } from '@/stores/collab'
import CollabPanel from '@/components/CollabPanel'
import { useToasts } from '@/stores/toasts'
import type { CollabContributor, Course, CourseItem } from '@/types/domain'
import { calcSlowIndex, gemNamesOf } from '@/lib/slowIndex'
import { splitIntoDays } from '@/lib/itinerary'
import { renderCourseCardBlob } from '@/lib/courseCard'
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
      <div className="page">
        <TopBar back />
        <div className="course-result__empty">
          <p className="course-result__empty-text">{t('course.empty')}</p>
          <button type="button" className="btn-primary" onClick={() => nav('/')}>
            {t('home.generate')}
          </button>
        </div>
      </div>
    )
  }

  // 빈 협업 코스 — "빈 코스로 함께 시작"으로 만든 방. 코스 키를 공유해 친구를 초대하고
  // 찜한 장소를 추가하거나 AI 추천으로 채우는, 함께 채워가는 화면을 보여준다.
  if (course.items.length === 0 && course.collabCode) {
    return (
      <div className="page">
        <TopBar back />
        <div className="page-body-narrow course-result__stack">
          <header className="course-result__empty-header">
            <span className="course-result__empty-emoji" aria-hidden><HandshakeIcon width={28} height={28} /></span>
            <h1 className="course-result__empty-title">
              {t('collab.emptyTitle')}
            </h1>
            <p className="course-result__empty-body">{t('collab.emptyBody')}</p>
          </header>

          <CollabPanel course={course} shareUrl={shareUrl} />

          <button type="button" className="btn-primary course-result__fill" onClick={() => nav('/')}>
            <SparkleIcon aria-hidden width={15} height={15} /> {t('collab.fillAi')}
          </button>

          {favPlaces.length > 0 && (
            <section className="surface-pane">
              <p className="eyebrow course-result__fav-label">
                {t('favorites.places')} → {t('course.addPlace')}
              </p>
              <div className="course-result__fav-row scrollbar-hide">
                {favPlaces.map((p, idx) => (
                  <button key={p.id} type="button" className="chip" onClick={() => addFavorite(idx)}>
                    + {p.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    )
  }

  // 빈 결과 — generateCourse 가 emptyCourse 를 반환한 경우. 사용자에게 다음 행동 안내.
  if (course.items.length === 0) {
    return (
      <div className="page">
        <TopBar back />
        <div className="course-result__empty-items">
          <span className="course-result__empty-items-emoji" aria-hidden>
            <MapIcon width={30} height={30} />
          </span>
          <div className="course-result__empty-items-box">
            <h2 className="course-result__empty-items-title">{t('course.emptyItemsTitle')}</h2>
            <p className="course-result__empty-items-body">{t('course.emptyItemsBody')}</p>
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

  /** 코스 티켓 카드 — Canvas PNG 생성 후 Web Share(파일) 또는 다운로드. */
  async function handleTicket() {
    if (!course) return
    try {
      const idx = calcSlowIndex(course)
      const gems = gemNamesOf(course, lang)
      const blob = await renderCourseCardBlob(course, shareUrl, {
        brand: t('appName'),
        region: t('brand.wordmarkRegion'),
        profileLabel: course.profile ? PROFILE_LABELS[course.profile][lang] : undefined,
        placesUnit: t('course.visitedUnit'),
        km: t('course.km'),
        min: t('course.min'),
        stayLabel: t('course.slow.stayLabel'),
        quietLabel: t('course.slow.quietLabel'),
        stayScore: idx.stayScore,
        quietScore: idx.quietScore,
        gemsLine: gems.length > 0 ? `${t('insights.gemBadge')} · ${gems.join(' · ')}` : undefined,
        scanHint: t('course.cardScan'),
        footer: t('course.slow.eyebrow'),
      })
      const file = new File([blob], 'shimmaru-course.png', { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: course.title })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'shimmaru-course.png'
        a.click()
        URL.revokeObjectURL(url)
      }
      pushToast(t('course.cardSaved'), { type: 'success' })
    } catch (e) {
      // 공유 시트에서 사용자가 취소한 경우는 조용히 무시.
      if (e instanceof DOMException && e.name === 'AbortError') return
      pushToast(t('course.cardFailed'), { type: 'error' })
    }
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

  // 제목 인라인 편집 — 항상 편집 가능. blur 시 변경분만 반영(협업 publish 포함).
  function commitTitle(next: string) {
    if (!course) return
    const v = next.trim()
    if (!v || v === course.title) return
    applyCourse({ ...course, title: v })
  }

  return (
    <div className="page">
      <TopBar
        back
        right={
          <button
            type="button"
            aria-label={t('course.share')}
            onClick={() => void handleShare()}
            className="course-result__share-btn"
          >
            {t('course.share')}
          </button>
        }
      />

      <div className="page-body course-result__body">
        <header>
          <p className="eyebrow">{t('course.headerEyebrow')}</p>
          {/* 제목 — 항상 편집 가능(헤딩처럼 보이는 인라인 입력) + 연필 힌트. 원격 변경 시 key 로 재동기화. */}
          <div className="course-result__title-wrap">
            <input
              key={course.title}
              type="text"
              className="course-result__title-input"
              defaultValue={course.title}
              placeholder={t('course.titlePlaceholder')}
              aria-label={t('course.titlePlaceholder')}
              onBlur={(e) => commitTitle(e.target.value)}
            />
            <PencilIcon className="course-result__title-pencil" />
          </div>
          <div className="course-result__badges">
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
            <div className="card-pad course-result__stats">
              <Stat
                label={t('course.distance')}
                value={`${course.totalDistanceKm}`}
                unit={t('course.km')}
              />
              <Stat
                label={t('course.byCar')}
                icon={<CarIcon className="stat__icon" />}
                value={`${carMin}`}
                unit={t('course.min')}
              />
              <Stat
                label={t('course.byTransit')}
                icon={<TransitIcon className="stat__icon" />}
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

        {/* 실시간 협업 — 코스 키(방 코드)로 친구와 같이 CRUD. PDF/인쇄에는 제외(코스 정보만). */}
        <div className="print-hide">
          <CollabPanel course={course} shareUrl={shareUrl} />
        </div>

        {/* Map (IDE-pane analog) + List */}
        <div className="course-result__layout print-list-only">
          <div className="course-result__map-pane print-hide">
            <KakaoMap course={course} className="course-result__map" />
          </div>

          <div className="course-result__list-col">
            <div className="course-result__list-head print-hide">
              <p className="course-result__reorder-hint">{t('course.reorderHint')}</p>
              {course.items.length >= 3 && (
                <button type="button" className="btn-ghost-outline" onClick={handleReoptimize}>
                  <RouteIcon className="h-4 w-4" /> {t('collab.reoptimize')}
                </button>
              )}
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={course.items.map((i) => i.place.id)} strategy={verticalListSortingStrategy}>
                {/* 날짜별 일정표 — 숙박(한옥/템플스테이) 앵커 기준 DAY 분할. 표시 전용(데이터 불변). */}
                <ol className="course-result__list">
                  {(() => {
                    const dayPlans = splitIntoDays(course)
                    const multiDay = dayPlans.length > 1
                    let idx = 0
                    return dayPlans.map((dp) => (
                      <Fragment key={dp.day}>
                        {multiDay && (
                          <li className="cr-day" aria-label={`DAY ${dp.day}`}>
                            <span className="cr-day__label">DAY {dp.day}</span>
                            <span className="cr-day__meta">
                              {dp.items.length}
                              {t('course.visitedUnit')} · {dp.distanceKm}
                              {t('course.km')}
                            </span>
                            <span className="cr-day__rule" aria-hidden />
                          </li>
                        )}
                        {dp.items.map((it) => {
                          idx++
                          return (
                            <SortableRow
                              key={it.place.id}
                              item={it}
                              index={idx}
                              lang={lang}
                              collab={Boolean(course.collabCode)}
                              voted={(it.votes ?? []).includes(meId)}
                              voteCount={(it.votes ?? []).length}
                              contributor={it.addedBy ? contributorById.get(it.addedBy) : undefined}
                              onOpen={() => nav(`/place/${it.place.id}`, { state: { place: it.place } })}
                              onVote={() => handleVote(it.place.id)}
                              onRemove={() => removeItem(it.place.id)}
                            />
                          )
                        })}
                      </Fragment>
                    ))
                  })()}
                </ol>
              </SortableContext>
            </DndContext>

            {favPlaces.length > 0 && (
              <section className="surface-pane course-result__add print-hide">
                <p className="eyebrow course-result__fav-label">
                  {t('favorites.places')} → {t('course.addPlace')}
                </p>
                <div className="course-result__fav-row scrollbar-hide">
                  {favPlaces.map((p, idx) => (
                    <button
                      key={p.id}
                      type="button"
                      className="chip course-result__fav-chip"
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
        </div>

        {/* actions — 보조(지도·PDF·홈) 그룹 + 주요(저장) */}
        <div className="course-result__actions print-hide">
          <div className="course-result__actions-group">
            <button type="button" className="btn-secondary" onClick={() => nav('/course/map')}>
              <MapIcon aria-hidden width={14} height={14} /> {t('course.viewMap')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.print()}
              title={t('course.pdfHint')}
            >
              <DocumentIcon aria-hidden width={14} height={14} /> {t('course.savePdf')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handleTicket()}
              title={t('course.cardHint')}
            >
              <FestivalIcon aria-hidden width={14} height={14} /> {t('course.ticketCard')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setAddHomeOpen(true)}
              title={t('course.addToHomeHint')}
            >
              <MobileIcon aria-hidden width={14} height={14} /> {t('course.addToHome')}
            </button>
          </div>
          <button
            type="button"
            className={isSaved ? 'btn-secondary' : 'btn-download'}
            onClick={handleSave}
          >
            {isSaved ? (
              <>
                <CheckIcon className="h-4 w-4" /> {t('course.saved')}
              </>
            ) : (
              t('course.save')
            )}
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

/**
 * 코스 방문지 행 — 항상 편집 가능(직접 수정).
 * 드래그 핸들로 순서변경 · 썸네일/이름 클릭으로 상세 · 하트 투표(협업) · ✕ 삭제.
 * 편집 컨트롤(핸들·투표·삭제)은 print-hide 로 인쇄/PDF 에선 숨긴다.
 */
function SortableRow({
  item,
  index,
  lang,
  collab,
  voted,
  voteCount,
  contributor,
  onOpen,
  onVote,
  onRemove,
}: {
  item: CourseItem
  index: number
  lang: 'ko' | 'en' | 'ja' | 'zh'
  collab: boolean
  voted: boolean
  voteCount: number
  contributor?: CollabContributor
  onOpen: () => void
  onVote: () => void
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
      className={clsx('cr-row', isDragging && 'cr-row--dragging')}
    >
      <button
        type="button"
        className="cr-row__handle print-hide"
        aria-label={t('common.drag')}
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="num-badge">{String(index).padStart(2, '0')}</div>
      <button type="button" className="cr-row__thumb" onClick={onOpen} aria-label={item.place.name}>
        <Thumbnail src={item.place.thumbnail} alt={item.place.name} category={item.place.category} compact />
      </button>
      <button type="button" className="cr-row__main" onClick={onOpen}>
        <span className="cr-row__tagrow">
          <CategoryBadge category={item.place.category} lang={lang} />
          {contributor && (
            <span className="contributor-tag" style={{ backgroundColor: contributor.color }}>
              {contributor.name}
            </span>
          )}
        </span>
        <span className="cr-row__name">{item.place.name}</span>
        {index > 1 && (
          <span className="cr-row__meta">
            +{item.distanceFromPrevKm}{t('course.km')}
            <span className="course-result__seg-sep">·</span>
            <CarIcon aria-hidden width={12} height={12} /> {segmentCarMinutes(item.distanceFromPrevKm)}{t('course.min')}
            <span className="course-result__seg-sep">·</span>
            <TransitIcon aria-hidden width={12} height={12} /> {segmentTransitMinutes(item.distanceFromPrevKm)}{t('course.min')}
          </span>
        )}
      </button>
      <div className="cr-row__trailing print-hide">
        {collab && (
          <button
            type="button"
            onClick={onVote}
            className={clsx('vote-btn', voted && 'is-on')}
            aria-pressed={voted}
            aria-label={t('collab.vote')}
          >
            <HeartIcon aria-hidden filled={voted} width={13} height={13} /> {voteCount || ''}
          </button>
        )}
        <button type="button" onClick={onRemove} className="cr-row__remove" aria-label={t('course.remove')}>
          <CloseIcon width={13} height={13} />
        </button>
      </div>
    </li>
  )
}

function Stat({
  label,
  value,
  unit,
  icon,
}: {
  label: string
  value: string
  unit: string
  icon?: ReactNode
}) {
  return (
    <div>
      <p className="stat__label">
        {icon}
        {label}
      </p>
      <p className="stat__value-row">
        <span className="stat-value">{value}</span>
        <span className="stat__unit">{unit}</span>
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
  const lang = useSettings((s) => s.lang)
  const idx = calcSlowIndex(course)
  // 코스가 경유하는 "숨은 보석"(데이터랩 한적 상위 3) 시군 — 데이터 미로드면 빈 배열.
  const gemNames = useMemo(() => gemNamesOf(course, lang), [course, lang])
  const labelTone: Record<typeof idx.label, string> = {
    slow: 'slow-index__label--slow',
    balanced: 'slow-index__label--balanced',
    busy: 'slow-index__label--busy',
  }
  return (
    <section className="slow-index">
      <header className="slow-index__header">
        <div>
          <p className="eyebrow">{t('course.slow.eyebrow')}</p>
          <h2 className="slow-index__title">
            {t('course.slow.title')}
          </h2>
          <p className="slow-index__body">
            {t('course.slow.body')}
          </p>
        </div>
        <span
          className={clsx('slow-index__label', labelTone[idx.label])}
        >
          <span className="slow-index__label-text">
            {t(`course.slow.${idx.label}`)}
          </span>
        </span>
      </header>
      <div className="slow-index__bars">
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
      {/* 숨은 보석 경유 — 데이터랩 한적 상위 3 시군을 지나면 스토리로 강조 */}
      {gemNames.length > 0 && (
        <Link to="/insights" className="slow-index__gems">
          <em className="slow-index__gems-badge">{t('insights.gemBadge')}</em>
          {t('insights.courseGems', { regions: gemNames.join(' · ') })} →
        </Link>
      )}
      {isVisitorDataActive() && (
        <p className="slow-index__source">
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
  const barClass = tone === 'emerald' ? 'score-bar__fill--emerald' : 'score-bar__fill--sky'
  const pct = Math.max(2, Math.min(100, score * 10))
  return (
    <div>
      <div className="score-bar__head">
        <span className="eyebrow">{label}</span>
        <span className="score-bar__score">
          {score.toFixed(1)} <span className="score-bar__score-max">/ 10</span>
        </span>
      </div>
      <div className="score-bar__track">
        <div
          className={clsx('score-bar__fill', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="score-bar__hint">{hint}</p>
    </div>
  )
}
