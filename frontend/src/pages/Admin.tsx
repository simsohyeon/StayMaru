import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TopBar from '@/components/TopBar'
import KhsPageHeader from '@/components/khs/KhsPageHeader'
import CuratedEditor from '@/components/admin/CuratedEditor'
import { useAdminSession } from '@/stores/adminSession'

const API = '/api/admin'

/**
 * 운영자 화면 — 테마 코스를 추가·수정·삭제한다.
 *
 * 관문은 서버(api/admin.ts)에 있고 여기서는 응답 코드만 읽는다 —
 * 번들은 공개되므로 프런트가 비밀번호를 알거나 비교하는 일은 없다.
 *   locked : 401 (쿠키 없음/만료) → 로그인 폼
 *   ready  : 200 → 편집 화면
 *   off    : 503 — 서버에 ADMIN_PASSWORD 가 없거나 너무 짧아 기능 자체가 꺼짐
 *
 * 세션 확인은 DB 를 건드리지 않는 `?action=session` 으로 한다.
 * 편집 화면이 DB 사정(표 없음 등)을 스스로 설명하므로, 로그인 관문이 그 때문에 막히면 안 된다.
 */
type Gate =
  | { kind: 'loading' }
  | { kind: 'locked'; failed?: boolean }
  | { kind: 'ready' }
  | { kind: 'off'; reason: string }
  | { kind: 'error' }

export default function Admin() {
  const { t } = useTranslation()
  const setAuthedHint = useAdminSession((s) => s.setAuthed)
  const [gate, setGate] = useState<Gate>({ kind: 'loading' })
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}?action=session`, { credentials: 'same-origin' })
      // 메뉴에 '관리자'를 띄울지의 힌트 — 권한 자체는 매 요청마다 서버가 쿠키로 확인한다.
      setAuthedHint(res.ok)
      if (res.status === 401) return setGate({ kind: 'locked' })
      if (res.status === 503) {
        const reason = String(((await res.json().catch(() => ({}))) as { reason?: string }).reason ?? '')
        return setGate({ kind: 'off', reason })
      }
      setGate(res.ok ? { kind: 'ready' } : { kind: 'error' })
    } catch {
      setGate({ kind: 'error' })
    }
  }, [setAuthedHint])

  // 마운트 시 한 번 세션을 확인한다 — 쿠키가 살아 있으면 곧장 편집 화면, 아니면 401 → 로그인 폼.
  useEffect(() => {
    async function run() {
      await load()
    }
    void run()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`${API}?action=login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      })
      setPassword('')
      if (!res.ok) return setGate({ kind: 'locked', failed: true })
      setAuthedHint(true)
      setGate({ kind: 'ready' })
    } catch {
      setGate({ kind: 'locked', failed: true })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch(`${API}?action=logout`, { method: 'POST', credentials: 'same-origin' })
    } catch {
      /* 쿠키를 지우지 못해도 화면은 잠근다 — 서버 쿠키는 만료시각이 있어 스스로 끊긴다. */
    }
    setAuthedHint(false)
    setGate({ kind: 'locked' })
  }

  return (
    <div className="page khs-page">
      <TopBar title={t('admin.title')} />
      <KhsPageHeader title={t('admin.title')} trail={[{ label: t('admin.title') }]} />

      {gate.kind === 'loading' && <p className="admin__status">{t('admin.loading')}</p>}

      {gate.kind === 'error' && (
        <div className="admin__gate">
          <p className="admin__gate-error">{t('admin.loadFailed')}</p>
          <button type="button" className="btn-secondary" onClick={() => { setGate({ kind: 'loading' }); void load() }}>
            {t('admin.retry')}
          </button>
        </div>
      )}

      {gate.kind === 'off' && (
        <div className="admin__gate">
          <h2 className="admin__gate-title">{t('admin.offTitle')}</h2>
          <p className="admin__gate-hint">
            {gate.reason === 'admin-password-too-short' ? t('admin.offTooShort') : t('admin.offNotSet')}
          </p>
          <code className="admin__gate-code">ADMIN_PASSWORD</code>
        </div>
      )}

      {gate.kind === 'locked' && (
        <form className="admin__gate" onSubmit={submit}>
          <h2 className="admin__gate-title">{t('admin.lockTitle')}</h2>
          <p className="admin__gate-hint">{t('admin.lockHint')}</p>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            required
            aria-label={t('admin.passwordLabel')}
            placeholder={t('admin.passwordLabel')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {gate.failed && <p className="admin__gate-error" role="alert">{t('admin.loginFailed')}</p>}
          {/* 빈 입력은 required 가 막는다 — 비활성 버튼은 khs 테마에서 대비가 무너져 쓰지 않는다. */}
          <button type="submit" className="btn-primary admin__gate-submit" disabled={busy}>
            {busy ? t('admin.loginBusy') : t('admin.login')}
          </button>
        </form>
      )}

      {gate.kind === 'ready' && (
        <div className="page-body khs-page__body khs-page__body--single admin__wrap">
          <div className="admin__head">
            <p className="admin__scope-hint">{t('admin.scopeHint')}</p>
            <button type="button" className="btn-ghost-outline" onClick={logout}>
              {t('admin.logout')}
            </button>
          </div>
          <CuratedEditor />
        </div>
      )}
    </div>
  )
}
