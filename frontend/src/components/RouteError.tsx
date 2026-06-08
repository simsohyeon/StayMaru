import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * 라우트 단위 에러 경계. React Router 의 errorElement 로 루트에 연결한다.
 * 페이지 컴포넌트 렌더 중 throw 되거나, 코드 스플리팅 청크 로드가 실패해도(예: 배포 직후
 * 캐시된 구버전이 사라진 청크를 요청) 백지 대신 복구 가능한 화면을 보여준다.
 *
 * 청크 로드 실패는 보통 새 배포로 해시가 바뀐 경우라 "새로고침" 한 번이면 해결된다.
 */
export default function RouteError() {
  const error = useRouteError()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isChunkError =
    error instanceof Error &&
    /loading (chunk|css chunk|dynamically imported module)/i.test(error.message)

  const title = isChunkError ? t('error.updatedTitle') : t('error.crashedTitle')
  const desc = isChunkError ? t('error.updatedDesc') : t('error.crashedDesc')

  if (import.meta.env.DEV) {
    // 개발 중에는 원인 파악을 위해 콘솔에 원본 에러를 남긴다.
    console.error('[RouteError]', isRouteErrorResponse(error) ? error.status : error)
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="font-display text-5xl text-primary" aria-hidden>
        ⌓
      </div>
      <h1 className="mt-6 font-display text-2xl text-ink">{title}</h1>
      <p className="mt-3 text-body-md text-body break-keep">{desc}</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => window.location.reload()} className="btn-primary">
          ↻ {t('common.retry')}
        </button>
        <button type="button" onClick={() => navigate('/')} className="btn-secondary">
          {t('common.goHome')}
        </button>
      </div>
    </div>
  )
}
