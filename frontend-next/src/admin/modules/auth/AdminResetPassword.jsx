import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../../shared/adminApiClient'

export default function AdminResetPassword() {
  const [params] = useSearchParams()
  const nav = useNavigate()

  const token = useMemo(() => (params.get('token') || '').trim(), [params])

  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState({ err: '', ok: '' })
  const [busy, setBusy] = useState(false)

  const validate = () => {
    if (!p1 || !p2) return 'Vyplňte obě pole'
    if (p1 !== p2) return 'Hesla se neshodují'
    if (p1.length < 8) return 'Heslo musí mít alespoň 8 znaků'
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
      setMsg({ err: 'Chybí reset token', ok: '' })
      return
    }

    setBusy(true)
    try {
      await api.post('/api/admin/v1/auth/reset', { token, new_password: p1 })
      setMsg({ err: '', ok: 'Heslo úspěšně změněno. Přesměrování...' })
      setTimeout(() => nav('/admin/login', { replace: true }), 1500)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.response?.data?.message || 'Chyba při resetování hesla'
      setMsg({ err: String(detail), ok: '' })
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Chybí reset token</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Pro reset hesla potřebujete platný odkaz z emailu.
          </p>
          <Link
            to="/admin/forgot-password"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Vyžádat nový odkaz
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <span className="inline-block px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full dark:bg-blue-900 dark:text-blue-100">
            Admin
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            Nastavení nového hesla
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Zadejte nové heslo pro váš admin účet
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {msg.err && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {msg.err}
            </div>
          )}
          {msg.ok && (
            <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">
              {msg.ok}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nové heslo
            </label>
            <div className="flex gap-2">
              <input
                type={show ? 'text' : 'password'}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
                placeholder="••••••••"
                autoFocus
                required
              />
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                onClick={() => setShow(s => !s)}
              >
                {show ? 'Skrýt' : 'Zobrazit'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Potvrzení hesla
            </label>
            <input
              type={show ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={p2}
              onChange={(e) => setP2(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-500 dark:hover:bg-blue-600"
            disabled={busy || !token}
          >
            {busy ? 'Ukládání...' : 'Změnit heslo'}
          </button>

          <div className="text-center">
            <Link
              to="/admin/login"
              className="text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              Zpět na přihlášení
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
