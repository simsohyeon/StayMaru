import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCourses } from '@/stores/courses'
import { decodeShare } from '@/lib/share'
import { toast } from '@/stores/toasts'

export default function CourseShared() {
  const { t } = useTranslation()
  const { payload } = useParams<{ payload: string }>()
  const setCurrent = useCourses((s) => s.setCurrent)
  const nav = useNavigate()

  useEffect(() => {
    if (!payload) {
      nav('/', { replace: true })
      return
    }
    const c = decodeShare(payload)
    if (c) {
      setCurrent(c)
      nav('/course', { replace: true })
    } else {
      // 손상된 링크 — 사용자에게 명시적으로 알린 뒤 홈으로 이동
      toast(t('share.decodeFailed'), { type: 'error', duration: 4500 })
      nav('/', { replace: true })
    }
  }, [payload, setCurrent, nav, t])

  return (
    <p className="px-5 py-12 text-center font-mono text-caption text-muted">
      {'>'} {t('common.loading')}
    </p>
  )
}
