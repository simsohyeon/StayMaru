import { useEffect, useMemo, useRef, useState } from 'react'
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
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { useCollab } from '@/stores/collab'
import { recomputeCourse, reoptimizeCourse } from '@/lib/courseEngine'
import { toast } from '@/stores/toasts'
import type { CollabContributor, CourseItem } from '@/types/domain'

export default function CourseEdit() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const course = useCourses((s) => s.current)
  const setCurrent = useCourses((s) => s.setCurrent)
  const save = useCourses((s) => s.save)
  const favPlaces = useFavorites((s) => s.places)
  const meId = useCollab((s) => s.me.id)
  const publish = useCollab((s) => s.publish)

  const [items, setItems] = useState<CourseItem[]>(course?.items ?? [])
  const [title, setTitle] = useState(course?.title ?? '')

  // 기여자 id → 기여자(이름·색)
  const contributorById = useMemo(() => {
    const m = new Map<string, CollabContributor>()
    for (const c of course?.contributors ?? []) m.set(c.id, c)
    return m
  }, [course])

  // 협업 실시간 — 친구가 원격에서 코스를 바꾸면(current.updatedAt 변동) 편집 목록을 동기화.
  // 장소 구성(id 집합)이 달라졌을 때만 reseed 해 내 드래그 편집을 최대한 보존한다.
  const remoteSig = course?.collabCode
    ? `${course.updatedAt ?? ''}|${course.items.map((i) => i.place.id).join(',')}`
    : ''
  const lastSigRef = useRef(remoteSig)
  useEffect(() => {
    if (!course?.collabCode) return
    if (remoteSig === lastSigRef.current) return
    const localIds = items.map((i) => i.place.id).join(',')
    const remoteIds = course.items.map((i) => i.place.id).join(',')
    lastSigRef.current = remoteSig
    if (localIds !== remoteIds) {
      // 외부 스토어(zustand) 변경을 로컬 편집 상태에 동기화 — 의도된 external-sync.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(course.items)
      toast(t('collab.synced'), { type: 'info', duration: 2000 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteSig])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // 코스 없으면 홈으로 — 렌더 중 side-effect 대신 effect 에서 네비게이션.
  useEffect(() => {
    if (!course) nav('/')
  }, [course, nav])

  if (!course) return null

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setItems((cur) => {
      const oldIdx = cur.findIndex((i) => i.place.id === active.id)
      const newIdx = cur.findIndex((i) => i.place.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return cur
      return arrayMove(cur, oldIdx, newIdx)
    })
  }

  function removeAt(id: string) {
    setItems((cur) => cur.filter((i) => i.place.id !== id))
  }

  function addFavorite(idx: number) {
    const fav = favPlaces[idx]
    if (items.some((i) => i.place.id === fav.id)) return
    // 여행 릴레이 — 내가 추가한 장소에 addedBy 태그
    setItems((cur) => [
      ...cur,
      { place: fav, order: cur.length + 1, distanceFromPrevKm: 0, addedBy: meId },
    ])
  }

  // 엔진 재최적화 — 친구들이 아무 순서로 추가한 장소를 거점 기준 NN+2-opt 로 동선 재배치.
  function handleReoptimize() {
    if (!course) return
    const optimized = reoptimizeCourse({ ...course, title, items })
    setItems(optimized.items)
    toast(t('collab.reoptimized', { km: optimized.totalDistanceKm }), { type: 'success' })
  }

  function handleSave() {
    if (!course) return
    const updated = recomputeCourse({ ...course, title, items })
    setCurrent(updated)
    save(updated)
    publish(updated) // 협업 중이면 서버에 반영(아니면 no-op)
    nav('/course')
  }

  const recomputed = course ? recomputeCourse({ ...course, items }) : undefined

  return (
    <div className="page">
      <TopBar title={t('course.edit')} back />
      <div className="page-body-wide course-edit__body">
        <input
          type="text"
          className="input course-edit__title-input"
          placeholder={t('course.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="course-edit__toolbar">
          <p className="course-edit__hint">
            {t('course.reorderHint')} · {recomputed?.totalDistanceKm}
            {t('course.km')} · {recomputed?.estimatedTravelMinutes}
            {t('course.min')}
          </p>
          {items.length >= 3 && (
            <button
              type="button"
              className="btn-ghost-outline"
              onClick={handleReoptimize}
            >
              <span aria-hidden>⤳</span> {t('collab.reoptimize')}
            </button>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.place.id)} strategy={verticalListSortingStrategy}>
            <ul className="course-edit__list">
              {items.map((it, i) => (
                <Row
                  key={it.place.id}
                  item={it}
                  index={i + 1}
                  lang={lang}
                  contributor={it.addedBy ? contributorById.get(it.addedBy) : undefined}
                  onRemove={() => removeAt(it.place.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {favPlaces.length > 0 && (
          <section className="card-pad">
            <p className="eyebrow">
              {t('favorites.places')} → {t('course.addPlace')}
            </p>
            <div className="course-edit__fav-row scrollbar-hide">
              {favPlaces.map((p, idx) => (
                <button key={p.id} type="button" className="chip" onClick={() => addFavorite(idx)}>
                  + {p.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <button type="button" className="btn-download" onClick={handleSave}>
          {t('course.save')} →
        </button>
      </div>
    </div>
  )
}

function Row({
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
      className={clsx('ce-row', isDragging && 'ce-row--dragging')}
    >
      <button
        type="button"
        className="ce-row__handle"
        aria-label={t('common.drag')}
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="num-badge">
        {String(index).padStart(2, '0')}
      </div>
      <div className="ce-row__main">
        <div className="ce-row__tagrow">
          <CategoryBadge category={item.place.category} lang={lang} />
          {contributor && (
            <span
              className="contributor-tag"
              style={{ backgroundColor: contributor.color }}
            >
              {contributor.name}
            </span>
          )}
        </div>
        <div className="ce-row__name">{item.place.name}</div>
        <p className="ce-row__addr">{item.place.address}</p>
      </div>
      <button type="button" onClick={onRemove} className="ce-row__remove">
        {t('course.remove')}
      </button>
    </li>
  )
}
