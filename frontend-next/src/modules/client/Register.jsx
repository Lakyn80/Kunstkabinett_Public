import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../common/apiClient'
import { useI18n } from '../../i18n/I18nProvider'

export default function ClientRegister() {
  const { t } = useI18n()
  const nav = useNavigate()

  const formRef = useRef(null)
  const nameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const password2Ref = useRef(null)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [agreePrivacy, setAgreePrivacy] = useState(false)

  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const validate = () => {
    const name = (nameRef.current?.value || '').trim()
    const email = (emailRef.current?.value || '').trim()
    const password = passwordRef.current?.value || ''
    const password2 = password2Ref.current?.value || ''
    if (!name) return t('register.nameRequired')
    if (!email) return t('register.emailRequired')
    if (password.length < 8) return t('register.passwordMinLength')
    if (password !== password2) return t('register.passwordMismatch')
    if (!agreeTerms) return 'Musíte souhlasit s obchodními podmínkami'
    if (!agreePrivacy) return 'Musíte souhlasit se zpracováním osobních údajů'
    return ''
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    const v = validate()
    if (v) { setErr(v); return }

    setLoading(true)
    try {
      const envPath = process.env.NEXT_PUBLIC_REGISTER_PATH?.trim()
      const candidates = envPath ? [envPath] : ['/api/v1/auth/register']
      const payload = {
        name: (nameRef.current?.value || '').trim(),
        email: (emailRef.current?.value || '').trim(),
        password: passwordRef.current?.value || '',
      }

      let ok = false
      for (const path of candidates) {
        try {
          const { data } = await api.post(path, payload)
          const token = data?.access_token || data?.token || null
          if (token) {
            // Nastav token do localStorage a API header
            // Použij pouze client token (izolovaný od admin tokenu)
            localStorage.setItem('am_client_token', token)
            api.defaults.headers.common.Authorization = `Bearer ${token}`
            // Načti profil uživatele pomocí tokenu (ne login, protože už máme token)
            try {
              const meRes = await api.get('/api/v1/auth/me')
              // Pokud se podařilo načíst profil, můžeme pokračovat
              if (meRes?.data) {
                // Profil načten, AuthContext se aktualizuje automaticky při reloadu
              }
            } catch (meErr) {
              // Ignoruj chybu, uživatel bude přesměrován a AuthContext se aktualizuje
            }
          }
          nav('/account', { replace: true })
          ok = true
          if (formRef.current) formRef.current.reset()
          break
        } catch (err) {
          if (err?.response?.status === 404) continue
          const msg =
            err?.response?.data?.message ||
            err?.response?.data?.detail ||
            (Array.isArray(err?.response?.data?.errors) ? err.response.data.errors.join(', ') : '') ||
            err?.message || t('register.error')
          setErr(String(msg))
          setLoading(false)
          return
        }
      }
      if (!ok) setErr(t('register.notAvailable'))
    } finally {
      setLoading(false)
    }
  }

  return (
    // ❗ UI zachováno beze změn
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
            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <div className="flex flex-col justify-center">
                <span className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800">
                  {t('register.createAccount')}
                </span>
                <h1 className="mt-3 text-3xl font-bold sm:text-4xl text-slate-900 dark:text-white">{t('register.title')}</h1>
                <p className="mt-2 max-w-prose text-slate-700 dark:text-slate-300">
                  {t('register.subtitle')}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to="/products" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/70 transition">
                    {t('register.browseWorks')}
                  </Link>
                  <Link to="/login" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800/70 transition">
                    {t('register.alreadyHaveAccount')}
                  </Link>
                </div>
              </div>

              <div className="flex items-start lg:items-center">
                <form ref={formRef} onSubmit={onSubmit} className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
                  <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">{t('register.submit')}</h2>

                  {err && (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                      {err}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('register.name')}</label>
                    <input className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                      placeholder="Jan Novák" ref={nameRef} required />
                  </div>

                  <div className="mt-3 space-y-1">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">{t('register.email')}</label>
                    <input className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                      placeholder="jan.novak@example.com" ref={emailRef} type="email" autoComplete="email" required />
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="block text-sm text-slate-700 dark:text-slate-300">{t('register.password')}</label>
                      <input className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                        type="password" placeholder={t('register.passwordMin')} ref={passwordRef} autoComplete="new-password" required />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm text-slate-700 dark:text-slate-300">{t('register.password2')}</label>
                      <input className="input h-10 text-slate-900 dark:text-slate-100 dark:placeholder-slate-400 dark:bg-slate-900 dark:border-slate-700"
                        type="password" placeholder={t('register.passwordVerify')} ref={password2Ref} autoComplete="new-password" required />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 flex-1">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900"
                          checked={agreeTerms}
                          onChange={(e)=>setAgreeTerms(e.target.checked)}
                          required
                        />
                        <span>
                          Souhlasím s obchodními podmínkami a všeobecnými podmínkami.
                        </span>
                      </label>
                      <span className="group relative inline-flex mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <svg className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help" fill="currentColor" viewBox="0 0 20 20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="invisible group-hover:visible absolute left-6 top-0 z-10 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900 pointer-events-none">
                          Přečtěte si naše obchodní podmínky a všeobecné podmínky, které upravují vztah mezi vámi a Arte Moderno, včetně pravidel pro nákup a vrácení zboží.
                        </span>
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 flex-1">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900"
                          checked={agreePrivacy}
                          onChange={(e)=>setAgreePrivacy(e.target.checked)}
                          required
                        />
                        <span>
                          Souhlasím se zpracováním osobních údajů v souladu s GDPR.
                        </span>
                      </label>
                      <span className="group relative inline-flex mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <svg className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help" fill="currentColor" viewBox="0 0 20 20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="invisible group-hover:visible absolute left-6 top-0 z-10 w-64 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-white dark:text-slate-900 pointer-events-none">
                          Budeme zpracovávat vaše osobní údaje (jméno, email, adresa) za účelem realizace objednávky a poskytování našich služeb. Vaše údaje chráníme v souladu s GDPR.
                        </span>
                      </span>
                    </div>
                  </div>

                  <button className="mt-5 w-full h-10 rounded-xl bg-slate-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900 transition" disabled={loading}>
                    {loading ? t('register.submitting') : t('register.submit')}
                  </button>

                  <div className="mt-3 text-xs text-slate-700 dark:text-slate-300">
                    {t('register.hasAccount')} <Link to="/login" className="underline hover:opacity-80">{t('register.loginLink')}</Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
          {/* bez spodního CTA bloku */}
        </div>
      </div>
    </div>
  )
}
