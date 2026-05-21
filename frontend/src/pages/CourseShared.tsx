import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourses } from '@/stores/courses'
import { decodeShare } from '@/lib/share'

export default function CourseShared() {
  const { t } = useTranslation()
  const { payload } = useParams<{ payload: string }>()
  const setCurrent = useCourses((s) => s.setCurrent)
  const nav = useNavigate()

  useEffect(() => {
    if (!payload) return
    const c = decodeShare(payload)
    if (c) {
      setCurrent(c)
      nav('/course', { replace: true })
    } else {
      nav('/', { replace: true })
    }
  }, [payload, setCurrent, nav])

  return <p className="px-5 py-12 text-center font-mono text-caption text-muted">{'>'} {t('common.loading')}</p>
}
