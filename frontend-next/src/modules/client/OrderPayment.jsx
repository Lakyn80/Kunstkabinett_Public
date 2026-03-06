import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../common/apiClient.js'
import { useI18n } from '../../i18n/I18nProvider'

function fmtCurrency(n, currency = 'CZK'){
  const x = Number(n || 0)
  const locale = currency === 'EUR' ? 'de-DE' : 'cs-CZ'
  try { 
    return new Intl.NumberFormat(locale, {style:'currency', currency}).format(x) 
  } catch { 
    return `${x.toFixed(2)} ${currency}` 
  }
}

function absoluteUrlMaybe(u) {
  if (!u) return ''
  const s = String(u).trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s

  const base =
    (api?.defaults && api.defaults.baseURL) ||
    (typeof window !== 'undefined' ? window.location?.origin : '') ||
    ''

  if (!base) return s
  const normalizedBase = String(base).replace(/\/+$/, '')
  const normalizedPath = s.startsWith('/') ? s : `/${s}`
  return `${normalizedBase}${normalizedPath}`
}

export default function OrderPayment(){
  const { t } = useI18n()
  const { id } = useParams()
  const [order,setOrder] = useState(null)
  const [bank,setBank] = useState(null)
  const [loading,setLoading] = useState(true)
  const [err,setErr] = useState('')

  useEffect(()=>{ (async ()=>{
    setLoading(true); setErr('')
    try{
      const oRes = await api.get(`/api/client/v1/orders/${id}`)
      setOrder(oRes.data)
      
      // Načti bankovní informace - zkus GET /bank endpoint (nevyžaduje změnu stavu)
      try {
        const bRes = await api.get(`/api/client/v1/orders/${id}/bank`)
        setBank(bRes.data)
      } catch {
        // Pokud GET /bank selže, zkus POST /pay-intent (přepne stav na pending_payment)
        try {
          const bRes = await api.post(`/api/client/v1/orders/${id}/pay-intent/bank-transfer`)
          setBank({
            account_iban: bRes.data?.iban || null,
            variable_symbol: bRes.data?.vs_code || oRes.data?.vs_code || id,
            amount: bRes.data?.amount || oRes.data?.total || 0,
            currency: bRes.data?.currency || 'CZK',
            qr_png_url: `/api/client/v1/orders/${id}/bank/qr.png`,
          })
        } catch {
          setErr(t('orderPayment.errorLoadingPayment'))
        }
      }
    }catch{
      setErr(t('orderPayment.errorLoadingOrder'))
    }finally{
      setLoading(false)
    }
  })() },[id])

  const total = useMemo(() => {
    if (!order) return 0
    if (order.total != null) return Number(order.total) || 0
    const items = Array.isArray(order.items) ? order.items : []
    return items.reduce((s,i)=> s + Number(i.unit_price || i.price || 0) * Number(i.qty || i.quantity || 1), 0)
  }, [order])

  if (loading) return <div className="p-6">{t('orderPayment.loading')}</div>
  if (err) return (
    <div className="card p-6 space-y-3">
      <div className="text-red-600">{err}</div>
      <Link to={`/account/orders/${id}`} className="btn">{t('orderPayment.backToOrder')}</Link>
    </div>
  )
  if (!order) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/account/orders/${id}`} className="underline hover:opacity-80">{t('orderPayment.back')}</Link>
        <div className="text-sm">{t('orderPayment.status')} <b>{order.status}</b></div>
      </div>

      <div className="card p-6 space-y-4">
        <h1 className="text-xl font-semibold">{t('orderPayment.title')}</h1>

        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500">{t('orderPayment.amount')}</div>
            <div className="mt-1 font-medium">{fmtCurrency(total, bank?.currency || order?.currency || 'CZK')}</div>
          </div>
          <div>
            <div className="text-gray-500">{t('orderPayment.variableSymbol')}</div>
            <div className="mt-1 font-medium">{bank?.variable_symbol || order?.vs_code || order?.id}</div>
          </div>
          <div>
            <div className="text-gray-500">{t('orderPayment.account')}</div>
            <div className="mt-1 font-medium">{bank?.account_iban || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">{t('orderPayment.currency')}</div>
            <div className="mt-1 font-medium">{bank?.currency || 'CZK'}</div>
          </div>
        </div>

        <div className="pt-2">
          {bank?.qr_png_url
            ? <img alt={t('orderPayment.qrPayment')} className="h-56 w-56 rounded border" src={absoluteUrlMaybe(bank.qr_png_url)} />
            : <div className="text-sm text-amber-700">{t('orderPayment.qrPayment')} {t('common.error')}</div>}
        </div>

        <div className="text-sm text-slate-600">
          {order.status === 'pending_payment' ? t('orderPayment.statusPendingPayment') : `${t('orderPayment.status')} <b>${order.status}</b>.`}
        </div>
      </div>
    </div>
  )
}
