// src/modules/client/Login.jsx
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useI18n } from '../../i18n/I18nProvider'

function consumeAfterAuthRedirect() {
  try {
    const target = sessionStorage.getItem('after_login_redirect')
    if (target) {
      sessionStorage.removeItem('after_login_redirect')
      return target
    }
  } catch {}
  return '/account'
}

export default function ClientLogin() {
  const { t } = useI18n()
  const { login /*, loading*/ } = useAuth()
  const nav = useNavigate()
  const formRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setSubmitting(true)
    try {
      const email = emailRef.current?.value || ''
      const password = passwordRef.current?.value || ''
      await login(email, password)
      if (formRef.current) formRef.current.reset()
      nav(consumeAfterAuthRedirect(), { replace: true })
    } catch {
      setErr(t('login.error'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto">
      {/* ✅ OPRAVA: from-fuchsia-200 (bez mezer) */}
      <div className="relative min-h-full w-full bg-gradient-to-br from-fuchsia-200 via-rose-100 to-amber-100 dark:from-[#1a1025] dark:via-[#0f1a2d] dark:to-[#1b2a37] transition-colors">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-fuchsia-300/30 blur-3xl dark:hidden" />
          <div className="absolute top-32 -right-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl dark:hidden" />
          <div className="hidden dark:block absolute -top-28 -left-16 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="hidden dark:block absolute top-40 -right-24 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="hidden dark:block absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        {/* jednoduché odkazy místo navbaru */}
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-end gap-4">
            <Link to="/" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.home')}</Link>
            <Link to="/products" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.discover')}</Link>
            <Link to="/artists" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.artists')}</Link>
            <Link to="/blog" className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{t('nav.blog')}</Link>
          </div>
        </div>

        <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-16 sm:pt-16">
          {/* glass karta + rámeček */}
          <div className="rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur shadow-xl dark:border-slate-800 dark:bg-slate-900/60 transition-colors">
            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="flex flex-col justify-center">
                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-900/30 dark:text-fuchsia-100 dark:ring-fuchsia-800">
                  {t('login.welcomeBack')}
                </span>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl text-slate-900 dark:text-white">
                  {t('login.title')}
                </h1>
                <p className="mt-2 max-w-prose text-slate-700 dark:text-slate-300">
                  {t('login.subtitle')}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to="/products"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/70 transition"
                  >
                    {t('login.exploreWorks')}
                  </Link>
                  <Link
                    to="/blog"
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/70 transition"
                  >
                    {t('login.howItWorks')}
                  </Link>
                </div>
              </div>

              <div className="flex items-start lg:items-center">
                <form
                  ref={formRef}
                  onSubmit={onSubmit}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors"
                >
                  <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('login.submit')}</h2>

                  {err && (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      {err}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('login.email')}</label>
                    <input
                      className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                      placeholder="jan.novak@example.com"
                      ref={emailRef}
                      autoComplete="username"
                      required
                    />
                  </div>

                  <div className="mt-3 space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('login.password')}</label>
                    <input
                      className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                      type="password"
                      placeholder="••••••••"
                      ref={passwordRef}
                      autoComplete="current-password"
                      required
                    />
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <Link to="/reset-password" className="underline text-slate-700 hover:opacity-80 dark:text-slate-300">
                        {t('login.forgotPassword')}
                      </Link>
                      <Link to="/register" className="underline text-slate-700 hover:opacity-80 dark:text-slate-300">
                        {t('login.noAccount')}
                      </Link>
                    </div>
                  </div>

                  <button
                    className="mt-5 w-full h-10 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900 transition"
                    disabled={submitting}
                  >
                    {submitting ? t('login.submitting') : t('login.submit')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
