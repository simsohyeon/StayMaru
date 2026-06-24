import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCollab } from '@/stores/collab'
import { isCollabConfigured } from '@/lib/supabase'
import { toast } from '@/stores/toasts'

/**
 * 코스 키 참여 진입 — /join/:code (QR·링크로 들어옴).
 * 방에 참여(joinRoom)한 뒤 /course 로 이동. 실패 시 안내 후 홈으로.
 */
export default function CourseJoin() {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()
  const joinRoom = useCollab((s) => s.joinRoom)
  const nav = useNavigate()
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (!code) {
      nav('/', { replace: true })
      return
    }
    if (!isCollabConfigured()) {
      toast(t('collab.unconfigured'), { type: 'error', duration: 4500 })
      nav('/', { replace: true })
      return
    }
    void joinRoom(code).then((result) => {
      if (result === 'ok') {
        nav('/course', { replace: true })
      } else {
        toast(result === 'not-found' ? t('collab.notFound') : t('collab.joinFailed'), {
          type: 'error',
          duration: 4500,
        })
        nav('/', { replace: true })
      }
    })
  }, [code, joinRoom, nav, t])

  return (
    <p className="px-5 py-12 text-center font-mono text-caption text-muted md:px-10">
      {'>'} {t('collab.joining')}
    </p>
  )
}
