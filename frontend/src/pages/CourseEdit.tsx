import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TopBar from '@/components/TopBar'
import CategoryBadge from '@/components/CategoryBadge'
import { useCourses } from '@/stores/courses'
import { useSettings } from '@/stores/settings'
import { useFavorites } from '@/stores/favorites'
import { recomputeCourse } from '@/lib/courseEngine'
import type { CourseItem } from '@/types/domain'

export default function CourseEdit() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const lang = useSettings((s) => s.lang)
  const course = useCourses((s) => s.current)
  const setCurrent = useCourses((s) => s.setCurrent)
  const save = useCourses((s) => s.save)
  const favPlaces = useFavorites((s) => s.places)

  const [items, setItems] = useState<CourseItem[]>(course?.items ?? [])
  const [title, setTitle] = useState(course?.title ?? '')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (!course) {
    nav('/')
    return null
  }

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
    setItems((cur) => [...cur, { place: fav, order: cur.length + 1, distanceFromPrevKm: 0 }])
  }

  function handleSave() {
    if (!course) return
    const updated = recomputeCourse({ ...course, title, items })
    setCurrent(updated)
    save(updated)
    nav('/course')
  }

  const recomputed = course ? recomputeCourse({ ...course, items }) : undefined

  return (
    <div className="bg-canvas">
      <TopBar title={t('course.edit')} back />
      <div className="px-5 py-8 md:px-10 md:py-12 space-y-6 md:max-w-3xl">
        <input
          type="text"
          className="input text-display-sm"
          placeholder={t('course.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <p className="font-mono text-caption text-muted">
          {t('course.reorderHint')} · {recomputed?.totalDistanceKm}
          {t('course.km')} · {recomputed?.estimatedTravelMinutes}
          {t('course.min')}
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.place.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {items.map((it, i) => (
                <Row key={it.place.id} item={it} index={i + 1} lang={lang} onRemove={() => removeAt(it.place.id)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {favPlaces.length > 0 && (
          <section className="card-pad">
            <p className="eyebrow">
              {t('favorites.places')} → {t('course.addPlace')}
            </p>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 scrollbar-hide">
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
  onRemove,
}: {
  item: CourseItem
  index: number
  lang: 'ko' | 'en' | 'ja' | 'zh'
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
        aria-label="drag"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-ink font-mono text-sm text-canvas">
        {String(index).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1">
        <CategoryBadge category={item.place.category} lang={lang} />
        <div className="mt-1.5 text-title-sm text-ink truncate">{item.place.name}</div>
        <p className="text-caption text-muted truncate">{item.place.address}</p>
      </div>
      <button type="button" onClick={onRemove} className="font-mono text-[11px] text-muted hover:text-ink">
        {t('course.remove')}
      </button>
    </li>
  )
}
