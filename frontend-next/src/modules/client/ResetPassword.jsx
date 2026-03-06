import { useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../common/apiClient'
import { useI18n } from '../../i18n/I18nProvider'

export default function ResetPassword() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const nav = useNavigate()

  const token = useMemo(() => (params.get('token') || '').trim(), [params])

  // Pro request reset (zadání emailu)
  const requestFormRef = useRef(null)
  const emailRef = useRef(null)
  const [requestBusy, setRequestBusy] = useState(false)
  
  // Pro reset hesla (když je token)
  const resetFormRef = useRef(null)
  const p1Ref = useRef(null)
  const p2Ref = useRef(null)
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState({ err: '', ok: '' })
  const [busy, setBusy] = useState(false)

  const onRequestReset = async (e) => {
    e.preventDefault()
    setMsg({ err: '', ok: '' })
    const email = (emailRef.current?.value || '').trim()
    if (!email) {
      setMsg({ err: t('resetPassword.emailRequired'), ok: '' })
      return
    }

    setRequestBusy(true)
    try {
      const candidates = ['/auth/request-reset', '/api/auth/request-reset']
      let ok = false

      for (const path of candidates) {
        try {
          await api.post(path, { email })
          setMsg({ err: '', ok: t('resetPassword.emailSent') })
          if (requestFormRef.current) requestFormRef.current.reset()
          ok = true
          setRequestBusy(false)
          break
        } catch (err) {
          if (err?.response?.status === 404) continue
          const detail = err?.response?.data?.detail || err?.response?.data?.message || t('resetPassword.requestError')
          setMsg({ err: String(detail), ok: '' })
          setRequestBusy(false)
          return
        }
      }

      if (!ok) {
        setMsg({ err: t('resetPassword.notAvailable'), ok: '' })
        setRequestBusy(false)
      }
    } catch (err) {
      setMsg({ err: t('resetPassword.connectionError'), ok: '' })
      setRequestBusy(false)
    }
  }

  const validate = () => {
    const p1 = p1Ref.current?.value || ''
    const p2 = p2Ref.current?.value || ''
    if (!p1 || !p2) return t('resetPassword.fillBoth')
    if (p1 !== p2) return t('resetPassword.passwordMismatch')
    if (p1.length < 8) return t('resetPassword.passwordMinLength')
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg({ err: '', ok: '' })
    const v = validate()
    if (v) {
      setMsg({ err: v, ok: '' })
      return
    }
    if (!token) {
      setMsg({ err: t('resetPassword.missingToken'), ok: '' })
      return
    }

    setBusy(true)
    try {
      const candidates = ['/auth/reset', '/api/auth/reset']
      let ok = false
      
      for (const path of candidates) {
        try {
          const p1 = p1Ref.current?.value || ''
          await api.post(path, { token, new_password: p1 })
          setMsg({ err: '', ok: t('resetPassword.success') })
          if (resetFormRef.current) resetFormRef.current.reset()
        setTimeout(() => nav('/login', { replace: true }), 1200)
          ok = true
          setBusy(false)
          break
        } catch (err) {
          if (err?.response?.status === 404) continue
          const detail = err?.response?.data?.detail || err?.response?.data?.message || t('resetPassword.error')
          setMsg({ err: String(detail), ok: '' })
          setBusy(false)
          return
        }
      }
      
      if (!ok) {
        setMsg({ err: t('resetPassword.notAvailable'), ok: '' })
        setBusy(false)
      }
    } catch (err) {
      setMsg({ err: t('resetPassword.connectionError'), ok: '' })
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto">
      <div className="relative min-h-full w-full bg-gradient-to-br from-fuchsia-200 via-rose-100 to-amber-100 dark:from-[#1a1025] dark:via-[#0f1a2d] dark:to-[#1b2a37] transition-colors">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl dark:hidden" />
          <div className="absolute top-32 -right-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl dark:hidden" />
          <div className="hidden dark:block absolute -top-28 -left-16 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="hidden dark:block absolute top-40 -right-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="hidden dark:block absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-end gap-4">
            <Link to="/" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.home')}</Link>
            <Link to="/products" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.discover')}</Link>
            <Link to="/artists" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.artists')}</Link>
            <Link to="/blog" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.blog')}</Link>
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-16 sm:pt-16">
          <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur shadow-xl dark:border-slate-800 dark:bg-slate-900/60 transition-colors">
            <div className="p-6 lg:p-8">
              <div className="max-w-md mx-auto">
                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-100 dark:ring-blue-800">
                  {t('resetPassword.resetPassword')}
                </span>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl text-slate-900 dark:text-white">
                  {t('resetPassword.title')}
                </h1>
                <p className="mt-2 max-w-prose text-slate-700 dark:text-slate-300">
                  {token ? t('resetPassword.subtitle') : t('resetPassword.requestSubtitle')}
        </p>

                {!token ? (
                  // Formulář pro zadání emailu (request reset)
                  <form ref={requestFormRef} onSubmit={onRequestReset} className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
                    {msg.err && (
                      <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                        {msg.err}
                      </div>
                    )}
                    {msg.ok && (
                      <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
                        {msg.ok}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="block text-sm text-slate-700 dark:text-slate-300">{t('resetPassword.email')}</label>
                      <input
                        type="email"
                        className="input h-10 w-full text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                        placeholder="jan.novak@example.com"
                        ref={emailRef}
                        autoFocus
                        required
                      />
                    </div>

                    <button
                      className="mt-5 w-full h-10 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900 transition"
                      disabled={requestBusy}
                    >
                      {requestBusy ? t('resetPassword.sending') : t('resetPassword.sendEmail')}
                    </button>

                    <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
                      <Link to="/login" className="underline hover:opacity-80">{t('resetPassword.backToLogin')}</Link>
                    </div>
                  </form>
                ) : (
                  // Formulář pro nastavení nového hesla (když je token)
                  <form ref={resetFormRef} onSubmit={onSubmit} className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
                  {msg.err && (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      {msg.err}
                    </div>
                  )}
                  {msg.ok && (
                    <div className="mb-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
                      {msg.ok}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('resetPassword.newPassword')}</label>
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                        className="input h-10 flex-1 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                ref={p1Ref}
                placeholder="••••••••"
                autoFocus
                required
              />
              <button
                type="button"
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/70 transition"
                onClick={() => setShow(s => !s)}
                        aria-label={show ? t('resetPassword.hide') : t('resetPassword.show')}
              >
                        {show ? t('resetPassword.hide') : t('resetPassword.show')}
              </button>
            </div>
          </div>

                  <div className="mt-3 space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('resetPassword.confirmPassword')}</label>
            <input
              type={show ? 'text' : 'password'}
                      className="input h-10 w-full text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
              ref={p2Ref}
              placeholder="••••••••"
              required
            />
          </div>

                  <button
                    className="mt-5 w-full h-10 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900 transition"
                    disabled={busy || !token}
                  >
                    {busy ? t('resetPassword.saving') : t('resetPassword.submit')}
          </button>

                    <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
                      <Link to="/login" className="underline hover:opacity-80">{t('resetPassword.backToLogin')}</Link>
                    </div>
        </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
